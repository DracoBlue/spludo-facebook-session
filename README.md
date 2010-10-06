spludo-facebook-session
=======================

A FacebookSessionManager for Spludo <http://spludo.com>. Use Facebook-Connect as session handler.

Version: 1.0.0
Date: 2010/10/06

Official Site: <http://dracoblue.net/>

spludo-facebook-session is copyright 2010 by DracoBlue <http://dracoblue.net>

What is spludo-facebook-session?
-----------------------------

This small plugin enables the possibility to use Facebook-Connect as session
manager for spludo.

To make this extension work, you need [node-facebook-client][node-facebook-client]
library by DracoBlue, which is released under the MIT open source license.

  [node-facebook-client]: http://github.com/DracoBlue/node-facebook-client

Installation:
--------------

After putting the entire contents of the facebook session manager plugin into a single
folder in your applications plugins folder, it may look like this:

    myapp/
        plugins/
            facebook-session/
                README.md
                lib/
                    index.js
                    FacebookSessionManager.js

### Installing node-facebook-client

To make this extension work, you need [node-facebook-client][node-facebook-client]
library by DracoBlue, which is released under the MIT open source license.

There are two ways to install the node-facebook-client library: npm or download.

#### Installing node-facebook-client with npm

    npm install facebook-client

#### Downloading node-facebook-client

If you don't have npm available, you you can also download the node-facebook-client plugin
from the [node-facebook-client][node-facebook-client] page and put it into the 
`plugins/facebook-session/lib` folder. The `facebook-session` folder will look like this
now:

    facebook-session/
        README.md
        lib/
            index.js
            FacebookSessionManager.js
            facebook-client/
                FacebookSession.js
                FacebookClient.js
                ...
                
### Configure your SessionManager

After creating an app on facebook, retrieve the app_id, app_url and app_secret from
<http://www.facebook.com/developers/apps.php>.

Now open either local.config.js or config.js and add:

    config.setPathValue(["session_manager_engine"], "FacebookSessionManager");
    config.setPathValue(["facebook", "app_id"], "12209381209382103912"); // <-- your facebookid
    config.setPathValue(["facebook", "app_url"], "http://example.org/"); // <-- your website
    config.setPathValue(["facebook", "app_secret"], "12kjh312jk3h12jk3h12k"); <-- your secret

### Enabling the Facebook-Connect in the Layout

Open your HtmlLayout.ejs (or where the html is generated!) and add:

    <div id="fb-root"></div>
    <script type="text/javascript">
    // <!--
      window.fbAsyncInit = function() {
    <%
        var facebook_config = config.get("facebook",{});
    %>
          FB.init({appId: <%= JSON.stringify(facebook_config.app_id) %>, logging:false, status: true, cookie: true, xfbml: true});
          FB.Event.subscribe('auth.sessionChange', function(response) {
              document.location = document.location.href;
          });
      };
      
      (function() {
        var e = document.createElement('script'); e.async = true;
        e.src = document.location.protocol +
          '//connect.facebook.net/en_US/all.js';
        document.getElementById('fb-root').appendChild(e);
      }());
    // -->  
    </script>

before the closing </body> tag.

Example:
-------------------

If you want to display, who is logged in at the moment somewhere add the
following code to the html page (example is in .ejs):

    <%
        if (context.session) {
    %>
        Hey <a id="fb-auth-link" href="http://facebook.com/profile.php?id=<%=context.session["uid"]%>"><%=StringToolkit.encodeXml(context.session["name"])%></a>
    <%
        }
    %>
    <fb:login-button autologoutlink="true"></fb:login-button>
            
Output (logged in):

    Hey DracoBlue [LOGOUT]

Output (not logged in):

    [FACEBOOK LOGIN]


Storage
-------

The facebook session manager has the ability to store additional data. You may configure
it by using:

    config.setPathValue(["session", "engine"], "MongoDbStorage");
    config.setPathValue(["session", "engine_options"], {
        "host": "127.0.0.1",
        "port": "8012",
        "collection": "sessions",
        "database": "fb-test"
    });

This will use (the previously installed MongoDbStorage) at localhost:8012 to store the
additional data.

License
--------

node-facebook-client is licensed under the terms of MIT. See LICENSE for more information.
