// ==UserScript==
// @name         Line-Sticker-Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @updateURL    https://github.com/odominecraft/Tampermonkey-scripts/raw/master/line-sticker-downloader.user.js
// @downloadURL  https://github.com/odominecraft/Tampermonkey-scripts/raw/master/line-sticker-downloader.user.js
// @supportURL   https://github.com/odominecraft/Tampermonkey-scripts/issues
// @description  Downloads everything as a ZIP from the line Sticker store
// @author       https://github.com/odominecraft
// @icon         https://www.google.com/s2/favicons?sz=64&domain=store.line.me
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @match        https://store.line.me/stickershop/product/*
// @require      https://github.com/gildas-lormeau/zip.js/raw/master/dist/zip-full.js
// @require      https://github.com/eligrey/FileSaver.js/raw/master/dist/FileSaver.js
// ==/UserScript==
/*eslint-env browser*/
/* @ts-check */


(function () {
    'use strict';

    const menuCommandId = GM_registerMenuCommand("Download stickers", async (/** @type {MouseEvent | KeyboardEvent} */ev) => {

        /**
         * Ensures a filename is Windows-compatible
         * @param {String} name the filename
         * @returns {String} the filename, but safe
         */
        function safeFilename(name) {
            //RegExes for validating filename (source: https://stackoverflow.com/a/11101624)
            //var rg1=/^[^\\/:\*\?"<>\|]+$/; // forbidden characters \ / : * ? " < > |
            var rg2 = /^\./; // cannot start with dot (.)
            var rg3 = /^(nul|prn|con|lpt[0-9]|com[0-9])(\.|$)/i; // forbidden file names

            var rg1 = /[\\/:*?"<>|]/g

            return name.replace(rg1, "_").replace(rg2, "_").replace(rg3, "unallowed");
        }


        // First, create the HTML elements for the modal popup
        const modalWrapper = document.createElement('div');
        modalWrapper.classList.add('modal-wrapper');
        const modalContent = document.createElement('div');
        modalContent.classList.add('modal-content');
        //const closeButton = document.createElement('button');
        //closeButton.textContent = 'Close';

        // Add the content to the modal popup
        let statusMessage = document.createTextNode('Downloading...');
        modalContent.appendChild(statusMessage);
        modalContent.appendChild(document.createElement("br"));
        let progressBar = document.createElement("progress");
        progressBar.max = 100;
        progressBar.value = 0;
        modalContent.appendChild(progressBar);
        modalContent.appendChild(document.createElement("br"));
        //modalContent.appendChild(closeButton);
        modalWrapper.appendChild(modalContent);

        // Add the modal to the DOM
        document.body.appendChild(modalWrapper);

        // Set the styles for the modal popup
        modalWrapper.style.display = 'none';
        modalWrapper.style.position = 'fixed';
        modalWrapper.style.zIndex = '1';
        modalWrapper.style.left = '0';
        modalWrapper.style.top = '0';
        modalWrapper.style.width = '100%';
        modalWrapper.style.height = '100%';
        modalWrapper.style.overflow = 'auto';
        modalWrapper.style.backgroundColor = 'rgba(0,0,0,0.4)';
        modalWrapper.style.alignContent = "center";
        modalWrapper.style.justifyContent = "center";
        modalWrapper.style.alignItems = "center";
        modalWrapper.style.justifyItems = "center";
        modalContent.style.backgroundColor = '#fefefe';
        modalContent.style.margin = '15% auto';
        modalContent.style.padding = '20px';
        modalContent.style.border = '1px solid #888';
        //closeButton.style.float = 'right';

        function destroyModal() {
            modalWrapper.style.display = 'none';
            document.body.removeChild(modalWrapper);
        }

        // Add event listener to the close button to hide the modal
        //closeButton.addEventListener('click', destroyModal());

        // Finally, show the modal popup
        modalWrapper.style.display = 'grid';



        let ul = document.querySelector("ul.FnStickerList");

        let children = ul.querySelectorAll("li.FnStickerPreviewItem");

        console.log(`found ${children.length} stickers.`);

        let progAdd = 10 / children.length;
        statusMessage.nodeValue = "Getting list of stickers...";

        /** @type {{"type": "animation"|"static"|"animation_sound","id": String,"staticUrl": String,"fallbackStaticUrl": String,"animationUrl": String,"popupUrl": String,"soundUrl": String}[]} */
        const data = [];

        children.forEach((li) => {
            data.push(JSON.parse(li.attributes.getNamedItem("data-preview").value));
            progressBar.value += progAdd;
        });


        let title = document.querySelector("p.mdCMN38Item01Ttl").innerText || "";
        let author = document.querySelector("a.mdCMN38Item01Author").innerText || "";
        let authorUrl = document.querySelector("a.mdCMN38Item01Author").href || "";
        let description = document.querySelector("p.mdCMN38Item01Txt").innerText || "";
        let price = document.querySelector("p.mdCMN38Item01Price").innerText || "";
        let copyright = document.querySelector("p.mdCMN09Copy").innerText || "";
        let stickerUrl = document.location.href || "";

        // download everything
        let loc = `line-${safeFilename(document.location.href.split("/")[5] || "unknownId")}${(title === "") ? "" : ("-" + safeFilename(title))}/`;

        const model = (() => {

            let zipWriter;
            return {
                addFile(file, options) {
                    if (!zipWriter) {
                        zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { bufferedWrite: true });
                    }
                    return zipWriter.add(file.name, new zip.BlobReader(file), options);
                },
                async getBlobURL() {
                    if (zipWriter) {
                        const blobURL = URL.createObjectURL(await zipWriter.close());
                        zipWriter = null;
                        return blobURL;
                    } else {
                        throw new Error("Zip file closed");
                    }
                }
            };

        })();



        /**
         * uses tampermonkey to download a Line-URL
         * @param {String} url the line URL
         * @param {String} path the path in the zip file
         */
        function download(url, path) {
            return new Promise((resolve, reject) => {
                let signal;
                try {
                    let urlSplit = url.split("/");
                    let lastPart = urlSplit[urlSplit.length - 1].split(".");
                    let name = path + "." + safeFilename(lastPart[lastPart.length - 1].split(/[?#]/)[0]);

                    GM_xmlhttpRequest({
                        url,
                        method: "GET",
                        responseType: "blob",
                        onload: async (res) => {
                            if (res.readyState === 4) {
                                if (res.status.toString(10).startsWith("2")) {
                                    console.log("got", name);
                                    /** @type {Blob} */
                                    const data = await res.response;
                                    data.name = name;
                                    await model.addFile(data, { signal });
                                    resolve();
                                }
                            }
                        },
                        onerror: console.error
                    });

                } catch (error) {
                    console.error(error);
                    if (signal) console.error(signal);
                    reject();
                }
            });
        }

        progAdd = 80 / (data.length);
        statusMessage.nodeValue = "Downloading all stickers...";

        const promises = [];

        for (const key in data) {
            if (Object.hasOwnProperty.call(data, key)) {
                const el = data[key];

                if (typeof el.id !== "string" || el.id === "") {
                    return;
                }

                if (typeof el.animationUrl === "string" && el.animationUrl !== "") {
                    promises.push(download(el.animationUrl, loc + el.id + "-animation").then(() => progressBar.value += progAdd / 5));
                } else progressBar.value += progAdd / 5;
                if (typeof el.fallbackStaticUrl === "string" && el.fallbackStaticUrl !== "") {
                    promises.push(download(el.fallbackStaticUrl, loc + el.id + "-fallbackStatic").then(() => progressBar.value += progAdd / 5));
                } else progressBar.value += progAdd / 5;
                if (typeof el.popupUrl === "string" && el.popupUrl !== "") {
                    promises.push(download(el.popupUrl, loc + el.id + "-popup").then(() => progressBar.value += progAdd / 5));
                } else progressBar.value += progAdd / 5;
                if (typeof el.soundUrl === "string" && el.soundUrl !== "") {
                    promises.push(download(el.soundUrl, loc + el.id + "-sound").then(() => progressBar.value += progAdd / 5));
                } else progressBar.value += progAdd / 5;
                if (typeof el.staticUrl === "string" && el.staticUrl !== "") {
                    promises.push(download(el.staticUrl, loc + el.id + "-static").then(() => progressBar.value += progAdd / 5));
                } else progressBar.value += progAdd / 5;
            }
        }

        await Promise.allSettled(promises);

        {
            // add data as JSON to zip file
            let allData = { title, author, authorUrl, description, stickerUrl, price, copyright, data }
            let dataString = JSON.stringify(allData, undefined, 4);
            const myBlob = new Blob([dataString], { type: 'application/json' });
            myBlob.name = loc + "data.json";
            let signal;
            try {
                await model.addFile(myBlob, { signal });
            } catch (error) {
                console.error(error);
                if (signal) console.error(signal);
            }
        }


        try {// download the zip file
            statusMessage.nodeValue = "Saving ZIP...";
            let url = await model.getBlobURL();
            progressBar.value += 10;
            const outName = loc.replace(/\//g, "") + ".zip";

            let a = document.createElement("a");
            a.href = url;
            a.download = outName
            a.click();
            URL.revokeObjectURL(url);

            statusMessage.nodeValue = "Done.";

            destroyModal();

        } catch (error) {
            console.error(error);
        }

    }, "d");

    console.log("registered menuCommand", menuCommandId);
})();