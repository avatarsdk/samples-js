# AvatarSDK WEB API JS sample

In this sample, you could find how to query available avatar
computation/export parameters, create an avatar computation task, poll
its status and download avatar export files using JavaScript.


## How to start

You will need to complete the following steps before experimenting
with this sample:

  * Get AvatarSDK developer account at
    https://accounts.avatarsdk.com/developer/signup/
  * Create an application with Client credentials Authorization Grant
    at https://accounts.avatarsdk.com/developer/
  * Copy `client_id` and `client_secret` from the Client Access
    application at https://accounts.avatarsdk.com/developer/

Now you are ready to go:

  * Clone this repository to your computer
  * Run `serve.sh` script to start simple web server (requires
    `python3` installed) and navigate to http://localhost:9000
  * Fill `client_id` and `client_secret` fields with the corresponding
    values from the Developer page above and click Authorize button
  * See running requests in your browser developer tools


## How it works

[asdk.js](js/asdk.js) wraps API calls, since every request must include
`Authorization` header. It also parses JSON responses and handles
request errors. Every `AvatarSDK` method returns a `Promise`

[avatars_ui.js](js/avatars_ui.js) wraps UI/UX. It initializes
`AvatarSDK` and then:
  * build avatar computation and export parameters forms dynamically,
    based on API response (see `fillParametersGui` and
    `fillExportParametersGui`)
  * visualize selected parameters (see `generateComputationParameters`
    and `generateExportParameters`)
  * create and poll avatar computation task (see `onComputeAvatar`)
  * build available export files form (see `fillExportsGUI`)
  * download export files (see `downloadExportFile`)

[main.js](js/main.js) wraps authorization UI/UX. Please see the note
on authorization below.

This sample uses [lil-gui](https://lil-gui.georgealways.com) for the
GUI. 


## Note on the authorization

Avatar SDK WEB API uses OAuth 2.0 for authorization. Authorization
token retrieval form is present here purely for the sample
purpose. Production code must keep `client_id` and `client_secret` in
secret, perform authorization on the server-side and provide
frontend only with `access_token` (i.e. pass the `token` within
`config` into `avatars_ui.js :: init(config)` call).


## License

The 3-Clause BSD License

See [LICENSE.md](LICENSE.md)
