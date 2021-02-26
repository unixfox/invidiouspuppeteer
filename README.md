<p align="center"> :warning: This tool is a proof of concept, don't expect it to work properly. :warning:</p>

# How to use it
1. Open a new Chromium/Google Chrome session with the argument `--user-data-dir=/var/tmp/invidiouspuppeteer`.  
Example: `chromium --user-data-dir=/var/tmp/invidiouspuppeteer`
2. Solve a couple of Google Recaptcha on https://recaptcha-demo.appspot.com/recaptcha-v2-checkbox.php
3. Try to navigate on Google services (YouTube, Google Search), just to make it so the Google anti bot solution think you are a human.
4. Install the dependencies of this program: `npm install`.
5. Launch the program `puppeteer.js` with the environment variable `INVIDIOUS_CONFIG_LOCATION` pointing to your invidious config.yaml.   
Example: `INVIDIOUS_CONFIG_LOCATION=/invidious/config/config.yml node puppeteer.js`
6. After a while your invidious config should be updated with new cookies.

# Troubleshooting
## Crash with `Error: net::ERR_ABORTED`
This means your IP is not blocked.
## Error related to Docker
Internally the program restart the Docker containers that start with the name `invidious_invidious` so if you don't have Docker running the program will just crash after updating the Invidious config but that's fine.
You can remove this behavior by commenting the 105th line.