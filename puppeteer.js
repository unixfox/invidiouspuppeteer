import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import got from "got";
import { createCursor } from "ghost-cursor";
import { promises as fs } from 'fs';
import urlParse from "url";
import cookie from "cookie";
import restartContainers from "./restartDockerContainers.js";

function rdn(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
}

async function getTextFromAudio(audioBuffer) {
    const response = await got("https://api.wit.ai/speech", {
        method: 'post',
        body: audioBuffer,
        headers: {
            Authorization: 'Bearer JVHWCNWJLWLGN6MFALYLHAPKUFHMNTAC',
            'Content-Type': 'audio/mpeg3'
        },
        responseType: 'json'
    });
    return response.body.text.trim()
}

function waitForNetworkIdle(page, timeout, maxInflightRequests = 0) {
    page.on('request', onRequestStarted);
    page.on('requestfinished', onRequestFinished);
    page.on('requestfailed', onRequestFinished);

    let inflight = 0;
    let fulfill;
    let promise = new Promise(x => fulfill = x);
    let timeoutId = setTimeout(onTimeoutDone, timeout);
    return promise;

    function onTimeoutDone() {
        page.removeListener('request', onRequestStarted);
        page.removeListener('requestfinished', onRequestFinished);
        page.removeListener('requestfailed', onRequestFinished);
        fulfill();
    }

    function onRequestStarted() {
        ++inflight;
        if (inflight > maxInflightRequests)
            clearTimeout(timeoutId);
    }

    function onRequestFinished() {
        if (inflight === 0)
            return;
        --inflight;
        if (inflight === maxInflightRequests)
            timeoutId = setTimeout(onTimeoutDone, timeout);
    }
}

export default async function main(url) {
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--user-data-dir=/var/tmp/invidiouspuppeteer']
    })
    console.log('Running tests..')
    const page = await browser.newPage();
    const cursor = createCursor(page);
    console.log(await page._client.send('Network.getAllCookies'));
    if (url) {
        await page.goto(url, { waituntil: "networkidle0" });
    }
    else {
        await page.goto("https://www.youtube.com/browse_ajax?continuation=4qmFsgI8EhhVQzRRb2JVNlNURkIwUDcxUE12T0dONUEaIEVnWjJhV1JsYjNNd0FqZ0JZQUZxQUxnQkFDQUFlZ0V4&gl=US&hl=en",
            { waituntil: "networkidle0" });
        if (!page.url().startsWith("https://www.google.com/sorry/index")) {
            await browser.close();
            return;
        }
    }
    await page.waitForFunction(() => {
        const iframe = document.querySelector('iframe[src*="api2/anchor"]')
        if (!iframe) return false

        return !!iframe.contentWindow.document.querySelector('#recaptcha-anchor')
    })

    await page.setRequestInterception(true);
    page.on('request', async (request) => {
        if (await request.url().startsWith("https://www.youtube.com") && await urlParse.parse(await request.url(), true).query.google_abuse) {
            const googleAbuseQuery = await urlParse.parse(await request.url(), true).query.google_abuse;
            const googleAbuseCookieValue = await cookie.parse(googleAbuseQuery).GOOGLE_ABUSE_EXEMPTION;
            const invidiousConfigFileLocation = process.env.INVIDIOUS_CONFIG_LOCATION || './config.yml';
            let configContent = await fs.readFile(invidiousConfigFileLocation, 'utf8');
            configContent = configContent.split("\n")
            for (let i = 0; i < configContent.length; i++) {
                if (configContent[i].includes("cookies")) {
                    configContent.splice(i, 1);
                }
            }
            configContent = configContent.join("\n")
            configContent = configContent + "\ncookies: GOOGLE_ABUSE_EXEMPTION=" + googleAbuseCookieValue + "\n";
            await fs.writeFile(invidiousConfigFileLocation, configContent);
            await restartContainers();
        }
        request.continue();
    });

    let frames = await page.frames();
    const recaptchaFrame = frames.find(frame => frame.url().includes('api2/anchor'))

    const checkbox = await recaptchaFrame.$('#recaptcha-anchor')
    await cursor.click(checkbox);

    await page.waitForFunction(() => {
        const iframe = document.querySelector('iframe[src*="api2/bframe"]')
        if (!iframe) return false

        //const img = iframe.contentWindow.document.querySelector('.rc-image-tile-wrapper img')
        //return img && img.complete
        return true
    })

    frames = await page.frames()
    const imageFrame = frames.find(frame => frame.url().includes('api2/bframe'))
    const audioButton = await imageFrame.$('#recaptcha-audio-button')
    if (audioButton)
        await cursor.click(audioButton);
    try {
        await page.waitForFunction(() => {
            const iframe = document.querySelector('iframe[src*="api2/bframe"]')
            if (!iframe) return false

            return !!iframe.contentWindow.document.querySelector('.rc-audiochallenge-tdownload-link')
        }, { timeout: 1000 })
    } catch (error) {
        await browser.close();
        throw ('download link not found');
    }

    const audioLink = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="api2/bframe"]')
        return iframe.contentWindow.document.querySelector('#audio-source').src
    })

    const audioBytes = await page.evaluate(audioLink => {
        return (async () => {
            const response = await window.fetch(audioLink)
            const buffer = await response.arrayBuffer()
            return Array.from(new Uint8Array(buffer))
        })()
    }, audioLink)
    const audioTranscript = await getTextFromAudio(Buffer.from(new Uint8Array(audioBytes).buffer));
    const input = await imageFrame.$('#audio-response')
    await cursor.click(input);
    await input.type(audioTranscript, { delay: rdn(30, 75) })

    const verifyButton = await imageFrame.$('#recaptcha-verify-button')
    await cursor.click(verifyButton);

    await waitForNetworkIdle(page, 10000, 0);
    await browser.close();
}

main();
