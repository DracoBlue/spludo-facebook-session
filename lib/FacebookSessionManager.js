/*
 * This file is part of the spludo-facebook-session.
 * Copyright (c) 2010 DracoBlue, http://dracoblue.net/
 *
 * Licensed under the terms of MIT License. For the full copyright and license
 * information, please see the LICENSE file in the root folder.
 */

var FacebookClient = require("facebook-client").FacebookClient;
var FacebookToolkit = require("facebook-client").FacebookToolkit;

var querystring = require("querystring");

/**
 * @class The manager for all registered sessions based on facebook login cookies.
 * 
 * @extends Logging
 */
FacebookSessionManager = function(options) {
    options = options || {};

    if (typeof options.cookie_path !== "undefined") {
        this.cookie_path = options.cookie_path;
    } else {
        this.cookie_path = null;
    }
    
    if (typeof options.cookie_key !== "undefined") {
        throw new Error('You cannot set the cookie_key for facebook!');
    }
    
    var facebook_config = config.get("facebook",{});
    var app_secret = facebook_config.app_secret;
    
    this.cookie_key = "fbs_" + facebook_config.app_id;
    
    this.generateSignature = function(data) {
        return FacebookToolkit.generateSignature(data, app_secret);
    };
    
    var facebook_client = new FacebookClient(
        facebook_config.app_id,
        facebook_config.app_secret
    );

    this.getFacebookSessionByKey = function(session_key) {
        return facebook_client.getSessionByKey(session_key);
    };
    
    var engine = GLOBAL[options.engine || "MemoryStorage"];
    
    this.extra_data_storage = new engine("session_manager", options.engine_options || {});
};

extend(true, FacebookSessionManager.prototype, Logging.prototype);

FacebookSessionManager.prototype.logging_prefix = 'FacebookSessionManager';

FacebookSessionManager.prototype.removeSession = function(session_id) {
    throw new Error('You cannot remove a facebook session.');
};

FacebookSessionManager.prototype.getSession = function(session_id) {
    throw new Error('You cannot get a facebook session.');
};

FacebookSessionManager.prototype.setSession = function(session_id, session) {
    var self = this;
    return function(cb) {
        var session_extra = {};
        extend(true, session_extra, session);
        
        delete session_extra.uid;
        delete session_extra.expires;
        delete session_extra.session_key;
        delete session_extra.in_new_facebook;
        delete session_extra.added;
        delete session_extra.ip;
        delete session_extra.logged_out_facebook;
    
        delete session_extra.auth_token;
        delete session_extra.base_domain;
        delete session_extra.sig;
        delete session_extra.secret;
        
        self.extra_data_storage.set(session_id, session_extra)(function() {
            cb();
        });
    };
};

FacebookSessionManager.prototype.createSession = function(session) {
    throw new Error('You cannot create a facebook session.');
};


FacebookSessionManager.prototype.initializeWebContextSession = function (context, request) {
    var self = this;
    return function(cb) {
        var session = null;
        
        var session_id = null;
        
        if (context.cookies && typeof context.cookies[self.cookie_key] !== 'undefined') {
            session = querystring.parse(context.cookies[self.cookie_key]);
            if (typeof session['sig'] === 'undefined') {
                session = null;
            } else {
                var facebook_config = config.get("facebook",{});
                
                self.log('session', session);
                var session_sig = session['sig'];
                delete session['sig'];
                
                if (session_sig === self.generateSignature(session)) {
                    session['sig'] = session_sig;
                } else {
                    self.error('Trying to load with a wrong fb_sig', session_sig);
                    session = null;
                }
            }
        } else if (context.params['fb_sig_user']) {
            var request_params = context.params;
            if (request_params['fb_sig_user']) {
                var facebook_config = config.get("facebook",{});
                
                session = context.session || {};
                session.uid = String(request_params['fb_sig_user']);
                session.expires = request_params['fb_sig_expires'];
                session.session_key = request_params['fb_sig_session_key'];
                session.in_new_facebook = request_params['fb_sig_in_new_facebook'] === '1' ? true : false;
                session.added = request_params['fb_sig_added'] === '1' ? true : false;
                session.ip = context.request_headers['x-fb-user-remote-addr'];
                session.logged_out_facebook = request_params['fb_sig_logged_out_facebook'] === '1' ? true : false;
                
                var data_for_signature = {};
                var fb_sig_matcher = /^fb_sig_/;
                for (var key in request_params) {
                    if (fb_sig_matcher.exec(key)) {
                        data_for_signature[key.substr(7)] = request_params[key];
                    }
                }
                
                if (request_params['fb_sig'] === self.generateSignature(data_for_signature)) {
                    session['sig'] = session_sig;
                } else {
                    self.error('Trying to load with a wrong fb_sig', request_params['fb_sig']);
                    session = null;
                }
            }
        }
    
        if (session !== null) {
            session_id = session.uid;
            self.extra_data_storage.get(session_id)(function(session_extra) {
                if (session_extra) {
                    extend(true, session, session_extra);
                }
        
                context.session = session;
                
                self.log('Found session!', session, session_extra);
                
                /*
                 * Is extra data from users.getInfo already set?
                 */
                if (session_extra && session_extra.name) {
                    cb(session_id);
                } else {
                    /*
                     * Extra data is not yet set, let's retrieve it!
                     */
                    self.getFacebookSessionByKey(session.session_key)(function(facebook_session) {
                        facebook_session.restCall("users.getInfo", {
                            fields: "name",
                            uids: session.uid
                        })(function(response_users) {
                            if (response_users.error_code) {
                                self.extra_data_storage.remove(session_id)(function() {
                                    context.session = null;
                                    cb(null);
                                });
                            } else {
                                session_extra = session_extra || {};
                                
                                session_extra.name = response_users[0].name;
                                
                                self.extra_data_storage.set(session_id, session_extra)(function() {
                                    extend(true, session, session_extra);
                                    cb(session_id);
                                });
                            }
                        });
                    });
                }
            });
        } else {
            cb(null);
        }
    };
};

FacebookSessionManager.prototype.finishWebContextSession = function (old_session_id, context, request) {
    var self = this;
    return function(cb) {
        if (old_session_id !== context.session_id) {
            var session_id = context.session_id;
    
            this.extra_data_storage.remove(old_session_id)(function() {
                if (session_id === null) {
                    ContextToolkit.removeCookie(context, self.cookie_key);
                } else {
                    ContextToolkit.setCookie(context, self.cookie_key, session_id, 0, self.cookie_path);
                }
                cb();
            });
        } else {
            cb();
        }
    };
};