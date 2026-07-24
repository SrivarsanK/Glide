How to Resize iframes with Message Events
  URL: https://dev.to/tvanantwerp/how-to-resize-iframes-with-message-events-2fec
  With `postMessage`, the embedded iframe site is able to send data to the parent window. In this case, I'm sending a message with the `clientHeight` of the app content and the parent window is using that information to adjust the height of the iframe.

```
<!-- parent.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <!-- The #target is where you want to create the iframe -->
    <div id="target"></div>
    <script>
      let container = document.querySelector("#target");
      const iframe = document.createElement("iframe");
      iframe.src = "https://location.of.iframe/index.html";
      iframe.width = "100%";
      iframe.style = "border: 0";

      // contentHeight sets an arbitrary default
      // then keeps track of the last size update
      // to avoid setting height again if nothing changes
      let contentHeight = 500;
      iframe.height = contentHeight;

      window.addEventListener('load', () => {
        container.appendChild(iframe);
      });

      window.addEventListener(
        'message',
        function (e) {
          // message that was passed from iframe page
          let message = e.data;

          // before I update the height,
          // I check to see if it's defined
          // and if it's changed, and if
          // it's not the iframe default
          // of 150px
          if (
            message.height &&
            message.height !== contentHeight &&
            message.height !== 150
          ) {
            iframe.height = message.height + 'px';
            contentHeight = message.height;
          }
        },
        false
      );
    </script>
  </body>
</html>
```

```
<!-- child.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <div class="resizing-app">Your app that could change size goes here.</div>
    <script>
      function resize() {
        setInterval(() => {
          // I noticed that sometimes undefined
          // was sent as the height to the parent,
          // so check for it before trying
          if (document.querySelector('.resizing-app').clientHeight) {
            window.parent.postMessage(
              { height: document.querySelector('.app').clientHeight },
              '*'
            );
          }
        }, 100); // updates ten times per second
      }

      window.addEventListener("load", resize);
    </script>
  </body>
</html>
```

Using Window.postMessage to resize an iframe - Tracy Lum
  URL: https://www.tracylum.com/blog/2018-05-21-using-windowpostmessage-to-resize-an-iframe/
  In order to get an iframe to fit the content within it, it's necessary to explicitly set the height, and you can do that by using window.postMessage.

Javascript --> iframe resizing using postMessage method
  URL: https://stackoverflow.com/questions/17816373/javascript-iframe-resizing-using-postmessage-method
  I'm trying to understand another Stackoverflow answer (cross-domain iframe resizer?) that purports to solve how to resize an iframe (hosted on a domain ...

Postmessage conflict · Issue #19 · davidjbradshaw/iframe-resizer
  URL: https://github.com/davidjbradshaw/iframe-resizer/issues/19
  I am trying to use window.parent.postMessage() your iframe resizer keeps sending events repeatedly to my event.
  Category: github

PostMessage
  URL: https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_window_post_message
  ## [Direct link to heading](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_window_post_message#message-types)    Message Types
### [Direct link to heading](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_window_post_message#lti.frameresize)    lti.frameResize
```
window.parent.postMessage(
  {
    subject: 'lti.frameResize',
    height: 400,
  },
  '*'
)
```

### [Direct link to heading](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_window_post_message#lti.enablescrollevents)    lti.enableScrollEvents
Sends a debounced postMessage event to the tool every time its containing iframe is scrolled.

```
window.parent.postMessage({subject: 'lti.enableScrollEvents'}, '*')
```

Window: postMessage() method - Web APIs - MDN Web Docs
  URL: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
  The window.postMessage() method safely enables cross-origin communication between Window objects; eg, between a page and a pop-up that it spawned.

postMessage with SharePoint iframe resize not working correctly
  URL: https://sharepoint.stackexchange.com/questions/181347/postmessage-with-sharepoint-iframe-resize-not-working-correctly
  I have a problem trying to resize an iframe inside a SharePoint Online environment (O365) added a Script Editor to the SharePoint page

Using Message Events to Resize an IFrame
  URL: https://www.thisdot.co/blog/using-message-events-to-resize-an-iframe
  When your iframe contents keep changing in height, use window.postMessage() to change the iframe's height in response.

How do I use the postMessage method with cross-site iframes?
  URL: https://www.youtube.com/watch?v=g5J0aUA2Um8
  " The answer is the window.postMessage() method. With postMessage, you can send messages from the iframe to the parent page. The parent page ...

How do I use the postMessage method with cross-site iframes?
  URL: https://www.youtube.com/watch?v=g5J0aUA2Um8
  " The answer is the window.postMessage() method. With postMessage, you can send messages from the iframe to the parent page. The parent page ...
