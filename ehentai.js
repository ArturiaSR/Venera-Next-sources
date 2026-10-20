/** @type {import('./_venera_.js')} */

function isCloudflareChallenge(status, body) {
    if (status === 403 || status === 503) {
        if (body && (
            body.indexOf("challenge-platform") !== -1 ||
            body.indexOf("cf-browser-verification") !== -1 ||
            body.indexOf("Just a moment") !== -1 ||
            body.indexOf("__cf_chl_") !== -1
        )) {
            return true;
        }
    }
    return false;
}

class Ehentai extends ComicSource {
    // Note: The fields which are marked as [Optional] should be removed if not used

    // name of the source
    name = "E-Hentai"

    // unique id of the source
    key = "ehentai"

    version = "1.2.3"

    minAppVersion = "1.5.3"

    // update url (必须锁定带有源 key 前缀的固定 Git Tag，严禁使用 @main)
    url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@ehentai-v1.2.3/ehentai.js"

    /**
     * cached api key
     * @type {string | null}
     */
    apiKey = null

    /**
     * cached uid key
     * @type {string | null}
     */
    uid = null

    get headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": this.baseUrl + "/",
        };
    }

    /**
     * @param url
     * @returns {{id: string, token: string}}
     */
    parseUrl(url) {
        let segments = url.split("/")
        let id = segments[4]
        let token = segments[5]
        return {
            id: id,
            token: token
        }
    }

    async checkEHEvent() {
        if (!this.isLogged) {
            return;
        }
        if (!this.loadSetting("ehevent")) {
            return;
        }
        const lastEvent = this.loadData("lastEventTime");
        const newTime = new Date().toISOString().split("T")[0];
        if (lastEvent == newTime) {
            return;
        }
        const res = await Network.get("https://e-hentai.org/news.php", this.headers);
        if (res.status !== 200) {
            return;
        }
        this.saveData("lastEventTime", newTime);
        const document = new HtmlDocument(res.body);
        try {
            const eventPane = document.getElementById("eventpane");
            if (eventPane == null) {
                return;
            }
            const dawnInfo = eventPane.querySelector("div > p:nth-child(2)");
            if (dawnInfo == null) {
                return;
            }
            UI.showMessage(dawnInfo.text);
        } finally {
            document.dispose();
        }
    }

    // [Optional] account related
    account = {

        /**
         * [Optional] login with webview
         */
        loginWithWebview: {
            url: "https://forums.e-hentai.org/index.php?act=Login&CODE=00",
            /**
             * check login status
             * @param url {string} - current url
             * @param title {string} - current title
             * @returns {boolean} - return true if login success
             */
            checkStatus: (url, title) => {
                return title === "E-Hentai Forums";
            },
            onLoginSuccess: async () => {
                let cookies = await Network.getCookies("https://forums.e-hentai.org")
                cookies.forEach((cookie) => {
                    cookie.domain = ".exhentai.org"
                })
                Network.setCookies("https://exhentai.org", cookies)
            },
        },

        loginWithCookies: {
            fields: [
                "ipb_member_id",
                "ipb_pass_hash",
                "igneous",
                "star",
            ],
            /**
             * Validate cookies, return false if cookies are invalid.
             *
             * Use `Network.setCookies` to set cookies before validate.
             * @param values {string[]} - same order as `fields`
             * @returns {Promise<boolean>}
             */
            validate: async (values) => {
                if (values.length !== 4) {
                    return false
                }
                if (values[0].length === 0 || values[1].length === 0) {
                    return false
                }
                let cookies = []
                for (let i = 0; i < values.length; i++) {
                    cookies.push(new Cookie({
                        name: this.account.loginWithCookies.fields[i],
                        value: values[i],
                        domain: ".e-hentai.org"
                    }))
                    cookies.push(new Cookie({
                        name: this.account.loginWithCookies.fields[i],
                        value: values[i],
                        domain: ".exhentai.org"
                    }))
                }
                Network.deleteCookies('https://e-hentai.org')
                Network.setCookies('https://e-hentai.org', cookies)
                let res = await Network.get(
                    "https://forums.e-hentai.org/",
                    {
                        "referer": "https://forums.e-hentai.org/index.php?",
                        "accept":
                            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "accept-encoding": "gzip, deflate, br",
                        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
                        "user-agent": this.headers["User-Agent"]
                    });
                if (res.status !== 200) {
                    return false
                }
                let document = new HtmlDocument(res.body)
                let name = null
                try {
                    name = document.querySelector("div#userlinks > p.home > b > a");
                } finally {
                    document.dispose()
                }
                return name != null
            }
        },

        /**
         * logout function, clear account related data
         */
        logout: () => {
            Network.deleteCookies("https://e-hentai.org");
            Network.deleteCookies("https://forums.e-hentai.org");
            Network.deleteCookies("https://exhentai.org");
        },

        // {string?} - register url
        registerWebsite: null
    }

    get baseUrl() {
        return 'https://' + this.loadSetting("domain");
    }

    get apiUrl() {
        return this.baseUrl.includes("exhentai") ? "https://exhentai.org/api.php" : "https://api.e-hentai.org/api.php"
    }

    getStarsFromPosition(position) {
        if (!position) return 0.5;
        let i = 0;
        while (i < position.length && position[i] !== ";") {
            i++;
        }
        switch (position.substring(0, i)) {
            case "background-position:0px -1px":
                return 5;
            case "background-position:0px -21px":
                return 4.5;
            case "background-position:-16px -1px":
                return 4;
            case "background-position:-16px -21px":
                return 3.5;
            case "background-position:-32px -1px":
                return 3;
            case "background-position:-32px -21px":
                return 2.5;
            case "background-position:-48px -1px":
                return 2;
            case "background-position:-48px -21px":
                return 1.5;
            case "background-position:-64px -1px":
                return 1;
            case "background-position:-64px -21px":
                return 0.5;
        }
        return 0.5;
    }

    async onLoadFailed() {
        let cookies = await Network.getCookies('https://e-hentai.org')
        cookies.forEach((c) => {
            c.domain = '.exhentai.org'
        })
        cookies = cookies.filter((item) => item.name !== 'igneous')
        Network.deleteCookies('https://exhentai.org')
        Network.setCookies('https://exhentai.org', cookies)
        throw `You may not have permission to access this page. Please check your network or try to login again.`
    }

    /**
     *
     * @param url {string}
     * @param isLeaderBoard {boolean}
     * @returns {Promise<{comics: Comic[], next: string?}>}
     */
    async getGalleries(url, isLeaderBoard) {
        try {
            this.checkEHEvent();
        } catch (_) {}
        let t = isLeaderBoard ? 1 : 0;
        let res
        try {
            res = await Network.get(url, this.headers);
        }
        catch (e) {
            if(e.toString().toLowerCase().includes("redirect")) {
                await this.onLoadFailed()
            }
            throw e
        }
        if (isCloudflareChallenge(res.status, res.body)) {
            throw "Cloudflare 验证拦截：请在漫画源设置中切换域名或登录账号完成验证后再试。"
        }
        if (res.status !== 200) {
            throw `Invalid status code: ${res.status}`
        }
        if(res.body.trim().length === 0) {
            await this.onLoadFailed()
        }
        if(res.body[0] !== '<') {
            if(res.body.includes("IP")) {
                throw "Your IP address has been temporarily banned by E-Hentai. Please wait or change IP."
            }
            if(res.body.includes("Viewing Limits Exceeded")) {
                throw "Viewing limits exceeded on E-Hentai. Please try again later or log in."
            }
            throw "Failed to load page: " + res.body.substring(0, 80)
        }
        let document = new HtmlDocument(res.body);
        let galleries = [];

        try {
            // compact mode
            for (let item of document.querySelectorAll("table.itg.gltc > tbody > tr")) {
                try {
                    let type = item.children[0 + t].children[0].text;
                    let time = item.children[1 + t].children[2].children[0].text;
                    let stars = this.getStarsFromPosition(item.children[1 + t].children[2].children[1].attributes["style"])
                    let cover = item.children[1 + t].children[1].children[0].children[0].attributes["src"];
                    if (cover && cover[0] === 'd') {
                        cover = item.children[1 + t].children[1].children[0].children[0].attributes["data-src"];
                    }
                    let title = item.children[2 + t].children[0].children[0].text;
                    let link = item.children[2 + t].children[0].attributes["href"];
                    let uploader = "";
                    let pages = 0;
                    try {
                        if (url.includes("/favorites.php")) {
                            pages = Number(item.children[1 + t].children[1].children[1].children[1].children[1].text.match(/\d+/)[0]);
                        } else {
                            pages = Number(item.children[3 + t].children[1].text.match(/\d+/)[0]);
                            uploader = item.children[3 + t].children[0].children[0].text;
                        }
                    } catch(e) {}
                    let tags = [];
                    let language = null
                    if (item.children[2 + t]?.children?.[0]?.children?.[1]?.children) {
                        for (let node of item.children[2 + t].children[0].children[1].children) {
                            let tag = node.attributes ? node.attributes["title"] : null;
                            if (!tag) continue;
                            if (tag.startsWith("language:")) {
                                let l = tag.split(":")[1].trim()
                                language = l === 'translated' ? language : l
                                continue
                            }
                            tags.push(tag)
                        }
                    }
                    galleries.push(new Comic({
                        id: link,
                        title: title,
                        subTitle: uploader,
                        cover: cover,
                        tags: tags,
                        description: time,
                        stars: stars,
                        maxPage: pages,
                        language: language
                    }));
                } catch(e) {
                }
            }

            // Thumbnail mode
            for (let item of document.querySelectorAll("div.gl1t")) {
                try {
                    let title = item.querySelector("a")?.text ?? "Unknown";
                    let type =
                        item.querySelector("div.gl5t > div > div.cs")?.text ?? "Unknown";
                    let time = item.querySelectorAll("div.gl5t > div > div").find((element) => !isNaN(Date.parse(element.text)))?.text;
                    let coverPath = item.querySelector("img")?.attributes["src"] ?? "";
                    let stars = this.getStarsFromPosition(item.querySelector("div.gl5t > div > div.ir")?.attributes["style"] ?? "");
                    let link = item.querySelector("a")?.attributes["href"] ?? "";
                    let pages = Number(item.querySelectorAll("div.gl5t > div > div").find((element) => element.text.includes("page"))?.text.match(/\d+/)?.[0] ?? "0");
                    galleries.push(new Comic({
                        id: link,
                        title: title,
                        cover: coverPath,
                        description: time,
                        stars: stars,
                        maxPage: pages,
                    }));
                } catch (e) {
                    //忽视
                }
            }

            // Extended mode
            for (let item of document.querySelectorAll("table.itg.glte > tbody > tr")) {
                try {
                    let title = item.querySelector("td.gl2e > div > a > div > div.glink")?.text ?? "Unknown";
                    let type = item.querySelector("td.gl2e > div > div.gl3e > div.cn")?.text ?? "Unknown";
                    let time = item.querySelectorAll("td.gl2e > div > div.gl3e > div").find((element) => !isNaN(Date.parse(element.text)))?.text ?? "Unknown";
                    let uploader = item.querySelector("td.gl2e > div > div.gl3e > div > a")?.text ?? "Unknown";
                    let coverPath = item.querySelector("td.gl1e > div > a > img")?.attributes["src"] ?? "";
                    let stars = this.getStarsFromPosition(item.querySelector("td.gl2e > div > div.gl3e > div.ir")?.attributes["style"] ?? "");
                    let link = item.querySelector("td.gl1e > div > a")?.attributes["href"] ?? "";
                    let tags = item.querySelectorAll('div.gt, div.gtl').map((e) => e.attributes["title"] ?? "").filter(Boolean);
                    let pages = Number(item.querySelectorAll("td.gl2e > div > div.gl3e > div").find((element) => element.text.includes("page"))?.text.match(/\d+/)?.[0] ?? "0");
                    let language = tags.find((e) => e.startsWith("language:") && !e.includes('translated'))?.split(":")[1]?.trim() ?? null;
                    galleries.push(new Comic({
                        id: link,
                        title: title,
                        subTitle: uploader,
                        cover: coverPath,
                        tags: tags,
                        description: time,
                        stars: stars,
                        maxPage: pages,
                        language: language
                    }))
                } catch (e) {
                    //忽视
                }
            }

            // minimal mode
            for (let item of document.querySelectorAll("table.itg.gltm > tbody > tr")) {
                try {
                    let title = item.querySelector("td.gl3m > a > div.glink")?.text ?? "Unknown";
                    let type = item.querySelector("td.gl1m > div.cs")?.text ?? "Unknown";
                    let time = item.querySelectorAll("td.gl2m > div").find((element) => !isNaN(Date.parse(element.text)))?.text ?? "Unknown";
                    let uploader = item.querySelector("td.gl5m > div > a")?.text ?? "Unknown";
                    let coverPath = item.querySelector("td.gl2m > div > div > img")?.attributes["src"];
                    if (coverPath && coverPath[0] === 'd') {
                        coverPath = item.querySelector("td.gl2m > div > div > img")?.attributes["data-src"];
                    }
                    let stars = this.getStarsFromPosition(item.querySelector("td.gl4m > div.ir")?.attributes["style"] ?? "");
                    let link = item.querySelector("td.gl3m > a")?.attributes["href"] ?? "";
                    galleries.push(new Comic({
                        id: link,
                        title: title,
                        subTitle: uploader,
                        cover: coverPath,
                        description: time,
                        stars: stars,
                    }))
                } catch (e) {
                    //忽视
                }
            }

            let nextButton = document.querySelector("a#dnext");
            let next = nextButton?.attributes ? nextButton.attributes["href"] : null;

            return {
                comics: galleries,
                next: next
            }
        } finally {
            document.dispose();
        }
    }

    // explore page list
    // 发现页规范：仅保留唯一标签，且与漫画源同名 (E-Hentai)
    explore = [
        {
            // title of the page.
            // title is used to identify the page, it should be unique
            title: "E-Hentai",

            /// multiPartPage or multiPageComicList or mixed
            type: "multiPageComicList",

            loadNext: (next) => {
                return this.getGalleries(next ?? this.baseUrl, false);
            }
        },
    ]

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "E-Hentai",
        parts: [
            {
                name: "Category",
                type: "fixed",
                categories: [
                    {
                        label: "Doujinshi",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["1", "", ""]
                            }
                        }
                    },
                    {
                        label: "Manga",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["2", "", ""]
                            }
                        }
                    },
                    {
                        label: "Artist CG",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["3", "", ""]
                            }
                        }
                    },
                    {
                        label: "Game CG",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["4", "", ""]
                            }
                        }
                    },
                    {
                        label: "Western",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["9", "", ""]
                            }
                        }
                    },
                    {
                        label: "Non-H",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["8", "", ""]
                            }
                        }
                    },
                    {
                        label: "Image Set",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["5", "", ""]
                            }
                        }
                    },
                    {
                        label: "Cosplay",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["6", "", ""]
                            }
                        }
                    },
                    {
                        label: "Asian Porn",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["7", "", ""]
                            }
                        }
                    },
                    {
                        label: "Misc",
                        target: {
                            page: "search",
                            attributes: {
                                keyword: "",
                                options: ["0", "", ""]
                            }
                        }
                    },
                ]
            }
        ],
        // enable ranking page
        enableRankingPage: true,
    }

    /// category comic loading related
    categoryComics = {
        ranking: {
            // For a single option, use `-` to separate the value and text, left for value, right for text
            options: [
                "15-yesterday",
                "13-month",
                "12-year",
                "11-all"
            ],
            /**
             * load ranking comics
             * @param option {string} - option from optionList
             * @param page {number} - page number
             * @returns {Promise<{comics: Comic[], maxPage: number}>}
             */
            load: async (option, page) => {
                let res = await this.getGalleries(`https://e-hentai.org/toplist.php?tl=${option}&p=${page-1}`, true);
                let comics = res.comics
                if(this.loadSetting('domain') === 'exhentai.org') {
                    comics.forEach((e) => {
                        e.id = e.id.replace('e-hentai', 'exhentai')
                    })
                }
                return {
                    comics: comics,
                    maxPage: 200,
                }
            }
        }
    }

    /// search related
    search = {
        /**
         * load search result with next page token
         * @param keyword {string}
         * @param options {(string)[]} - options from optionList
         * @param next {string | null}
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        loadNext: async (keyword, options, next) => {
            let category = [];
            if (options && options[0]) {
                try {
                    let parsed = JSON.parse(options[0]);
                    category = Array.isArray(parsed) ? parsed : [parsed];
                } catch (_) {
                    category = [options[0]];
                }
            } else {
                category = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
            }

            let stars = options && options[1] ? options[1] : null;
            let language = options && options[2] ? options[2] : null;
            let fcats = 1023
            for(let c of category) {
                let num = Number(c);
                if (!isNaN(num)) {
                    fcats -= 1 << num;
                }
            }
            let kw = keyword ? keyword.trim() : "";
            if(language && !kw.includes("language:")) {
                kw = kw ? `${kw} language:${language}` : `language:${language}`;
            }
            let url = `${this.baseUrl}/?f_search=${encodeURIComponent(kw)}`
            if(fcats) {
                url += `&f_cats=${fcats}`
            }
            if(stars) {
                url += `&f_srdd=${stars}`
            }
            return this.getGalleries(next ?? url, false);
        },

        // provide options for search
        optionList: [
            {
                // type: select, multi-select, dropdown
                type: "multi-select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "0-Misc",
                    "1-Doujinshi",
                    "2-Manga",
                    "3-Artist CG",
                    "4-Game CG",
                    "5-Image Set",
                    "6-Cosplay",
                    "7-Asian Porn",
                    "8-Non-H",
                    "9-Western",
                ],
                // option label
                label: "Category",
                // default selected options
                default: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            },
            {
                // type: select, multi-select, dropdown
                type: "dropdown",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-<none>",
                    "0-0",
                    "1-1",
                    "2-2",
                    "3-3",
                    "4-4",
                    "5-5",
                ],
                // option label
                label: "Min Stars",
            },
            {
                // type: select, multi-select, dropdown
                type: "dropdown",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-<none>",
                    "chinese-Chinese",
                    "english-English",
                    "japanese-Japanese",
                ],
                // option label
                label: "Language",
            },
        ],

        // enable tags suggestions
        enableTagsSuggestions: true,
    }

    // favorite related
    favorites = {
        // whether support multi folders
        multiFolder: true,
        singleFolderForSingleComic: true,
        /**
         * add or delete favorite.
         * throw `Login expired` to indicate login expired, App will automatically re-login and re-add/delete favorite
         * @param comicId {string}
         * @param folderId {string}
         * @param isAdding {boolean} - true for add, false for delete
         * @param favoriteId {string?} - [Comic.favoriteId]
         * @returns {Promise<any>} - return any value to indicate success
         */
        addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
            let parsed = this.parseUrl(comicId)
            let id = parsed.id
            let token = parsed.token
            if(isAdding) {
                let res = await Network.post(
                    `${this.baseUrl}/gallerypopups.php?gid=${id}&t=${token}&act=addfav`,
                    {
                        ...this.headers,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    `favcat=${folderId}&favnote=&apply=Add+to+Favorites&update=1`
                );
                if (res.status !== 200 || res.body.length === 0 || res.body[0] !== "<") {
                    throw "Failed to add favorite"
                }
                return "ok"
            } else {
                let res = await Network.post(
                    `${this.baseUrl}/gallerypopups.php?gid=${id}&t=${token}&act=addfav`,
                    {
                        ...this.headers,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    `favcat=favdel&favnote=&apply=Apply+Changes&update=1`
                );
                if (res.status !== 200 || res.body.length === 0 || res.body[0] !== "<") {
                    throw "Failed to delete favorite"
                }
                return "ok"
            }
        },
        /**
         * load favorite folders.
         * throw `Login expired` to indicate login expired, App will automatically re-login retry.
         * if comicId is not null, return favorite folders which contains the comic.
         * @param comicId {string?}
         * @returns {Promise<{folders: {[p: string]: string}, favorited: string[]}>} - `folders` is a map of folder id to folder name, `favorited` is a list of folder id which contains the comic
         */
        loadFolders: async (comicId) => {
            try {
                this.checkEHEvent();
            } catch (_) {}
            let res = await Network.get(`${this.baseUrl}/favorites.php`, this.headers);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body);
            let folders = new Map();
            folders.set("-1", "All")
            let sum = 0;
            try {
                for (let item of document.querySelectorAll("div.fp")) {
                    if (item.text === "Show All Favorites") continue;
                    let name = item.children[2]?.text ?? `Favorite ${folders.size}`
                    let length = item.children[0]?.text;
                    if(length) {
                        name += ` (${length})`
                        sum += +length
                    }
                    folders.set((folders.size-1).toString(), name)
                }
                folders.set("-1", `All (${sum})`)
            } finally {
                document.dispose()
            }
            let favorited = []
            if(comicId) {
                let comic = await this.comic.loadInfo(comicId)
                if(comic.isFavorite) {
                    favorited.push(comic.folder)
                }
            }
            return {
                folders: folders,
                favorited: favorited
            }
        },
        loadNext: async (next, folder) => {
            let url = `${this.baseUrl}/favorites.php`;
            if(folder !== '-1') {
                url += `?favcat=${folder}`
            }
            return this.getGalleries(next ?? url, false);
        }
    }

    /// single comic related
    comic = {
        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            try {
                this.checkEHEvent();
            } catch (_) {}
            let res = await Network.get(id, {
                ...this.headers,
                'cookie': 'nw=1'
            });
            if (isCloudflareChallenge(res.status, res.body)) {
                throw "Cloudflare 验证拦截：请在漫画源设置中切换域名或登录账号完成验证后再试。"
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            if(res.body.trim().length === 0) {
                throw `Exception: empty data\nYou may not have permission to access this page.`
            }
            let document = new HtmlDocument(res.body);

            try {
                if (this.isLogged && this.loadSetting("hvevent")) {
                    const eventPane = document.getElementById("eventpane");
                    if (eventPane != null) {
                        const hvUrl = eventPane.querySelector('div > a')?.attributes['href'];
                        if (hvUrl != null) {
                            UI.showDialog(
                                "HentaiVerse",
                                this.translate("hentaiverse"),
                                [
                                    {
                                        text: this.translate("cancel"),
                                        callback: () => {}
                                    },
                                    {
                                        text: this.translate("fight"),
                                        callback: () => {
                                            UI.launchUrl(hvUrl);
                                        }
                                    }
                                ]
                            );
                        }
                    }
                }

                let tags = new Map();
                for(let tr of document.querySelectorAll("div#taglist > table > tbody > tr")) {
                    if (tr.children && tr.children.length >= 2) {
                        let catName = tr.children[0].text;
                        if (catName.endsWith(":")) catName = catName.substring(0, catName.length - 1);
                        let tagList = [];
                        for (let e of tr.children[1].children) {
                            try {
                                let onclick = e.children?.[0]?.attributes?.["onclick"];
                                if (onclick) {
                                    let t = onclick.split(":")[1]?.split("'")?.[0];
                                    if (t) tagList.push(t);
                                } else if (e.children?.[0]?.text) {
                                    tagList.push(e.children[0].text.trim());
                                }
                            } catch (_) {}
                        }
                        tags.set(catName, tagList);
                    }
                }

                let maxPage = "1"
                for(let element of document.querySelectorAll("td.gdt2")) {
                    if (element.text.includes("page")) {
                        let m = element.text.match(/\d+/);
                        if (m) maxPage = m[0];
                    }
                }

                let isFavorited = true;
                if(document.querySelector("a#favoritelink")?.text === " Add to Favorites") {
                    isFavorited = false;
                }
                let folder = null
                if(isFavorited) {
                    try {
                        let favEl = document.querySelector("div#fav");
                        let style = favEl?.children?.[0]?.attributes?.["style"];
                        if (style && style.includes("background-position:0px -")) {
                            let position = style
                                .split("background-position:0px -")[1]
                                .split("px;")[0];
                            folder = (Number(position - 2) / 19).toString()
                        }
                    } catch (_) {}
                }

                let coverPath = "";
                let coverDiv = document.querySelector("div#gleft > div#gd1 > div");
                if (coverDiv && coverDiv.attributes && coverDiv.attributes["style"]) {
                    let m = RegExp("https?://([-a-zA-Z0-9.]+(/\\S*)?\\.(?:jpg|jpeg|gif|png|webp))").exec(coverDiv.attributes["style"]);
                    if (m) coverPath = m[0];
                }
                if (!coverPath) {
                    let imgEl = document.querySelector("div#gleft > div#gd1 img");
                    if (imgEl && imgEl.attributes && imgEl.attributes["src"]) {
                        coverPath = imgEl.attributes["src"];
                    }
                }

                let uploader = document.getElementById("gdn")?.children?.[0]?.text ?? "";

                let stars = Number(document.getElementById("rating_label")?.text?.split(':')?.[1]?.trim());
                if (isNaN(stars)) stars = 0;

                let categoryEl = document.querySelector("div.cs");
                let category = categoryEl ? categoryEl.text.trim() : "";
                if (category) {
                    tags.set("Category", [category]);
                }

                if (uploader) {
                    tags.set("uploader", [uploader]);
                }
                
                let timeEl = document.querySelector("div#gdd > table > tbody > tr > td.gdt2");
                let time = timeEl ? timeEl.text.trim() : "";

                let script = document.querySelectorAll("script").find((e) => e.text.includes("var token"));
                let variables = new Map();
                if (script) {
                    let reg = RegExp("var\\s+(\\w+)\\s*=\\s*(.*?);", "g");
                    for(let match of script.text.matchAll(reg)) {
                        variables.set(match[1], match[2]);
                    }
                }

                let title = document.querySelector("h1#gn")?.text ?? "Unknown";
                let subtitle = document.querySelector("h1#gj")?.text;
                if(subtitle != null && subtitle.trim() === "") {
                    subtitle = null;
                }
                let comments = this.comic.parseComments(document)

                let parsedMaxPage = Number(maxPage);
                let comic = new ComicDetails({
                    id: id,
                    title: title,
                    subTitle: subtitle,
                    cover: coverPath,
                    tags: tags,
                    stars: stars,
                    maxPage: !isNaN(parsedMaxPage) && parsedMaxPage > 0 ? parsedMaxPage : 1,
                    isFavorite: isFavorited,
                    uploadTime: time,
                    url: id,
                    comments: comments.comments,
                })

                comic.folder = folder
                comic.token = variables.get("token")
                this.apiKey = variables.get("apikey")
                if(this.apiKey && this.apiKey[0] === '"') {
                    this.apiKey = this.apiKey.substring(1, this.apiKey.length - 1)
                }
                this.uid = variables.get("apiuid")

                return comic;
            } finally {
                document.dispose()
            }
        },
        /**
         * [Optional] load thumbnails of a comic
         * @param id {string}
         * @param next {string?} - next page token, null for first page
         * @returns {Promise<{thumbnails: string[], next: string?, urls: string[]}>} - `next` is next page token, null for no more
         */
        loadThumbnails: async (id, next) => {
            let url = id
            if(next != null) {
                url += `?p=${next}`
            }
            let res = await Network.get(url, {
                ...this.headers,
                'cache-time': 'long',
                'prevent-parallel': 'true',
                'cookie': 'nw=1'
            });
            if(res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body);

            try {
                /**
                 * @param e {HtmlElement}
                 */
                let parseImageUrl = (e) => {
                    let style = e.attributes['style'];
                    if (!style) return "";
                    let widthMatch = style.match(/width:\s*(\d+)px/);
                    let heightMatch = style.match(/height:\s*(\d+)px/);
                    let width = widthMatch ? Number(widthMatch[1]) : 0;
                    let height = heightMatch ? Number(heightMatch[1]) : 0;
                    let r = style.split("background:transparent url(")[1]
                    if (!r) return "";
                    let url = r.split(")")[0].replace(/['"]/g, "");
                    let range = '';
                    if(r.includes('px')) {
                        let posMatch = r.match(/\)\s*-(\d+)px/);
                        if (posMatch) {
                            let position = Number(posMatch[1]);
                            range += `x=${position}-${position + width}`;
                        }
                    }
                    if (height) range += `${range ? "&" : ""}y=0-${height}`;
                    if (range) url += `@${range}`;
                    return url;
                };
                let images = document.querySelectorAll("div.gdtm > div").map((e) => {
                    return parseImageUrl(e)
                }).filter(Boolean);
                images.push(...document.querySelectorAll("div.gdtl > a > img").map((e) => e.attributes["src"]).filter(Boolean))
                if(images.length === 0) {
                    for(let e of document.querySelectorAll("div.gt100 > a > div")
                        .map(e => e.children.length === 0 ? e : e.children[0])) {
                        let parsed = parseImageUrl(e);
                        if (parsed) images.push(parsed);
                    }
                    for(let e of document.querySelectorAll("div.gt200 > a > div")
                        .map(e => e.children.length === 0 ? e : e.children[0])) {
                        let parsed = parseImageUrl(e);
                        if (parsed) images.push(parsed);
                    }
                }
                let urls = document.querySelectorAll("table.ptb > tbody > tr > td > a").map((e) => e.attributes["href"]).filter(Boolean)
                let pageNumbers = urls.map((e) => {
                    let n = Number(e.split("=")[1])
                    if(isNaN(n)) {
                        return 0
                    }
                    return n
                })
                let maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 0
                let current = 0
                if(next) {
                    current = Number(next)
                }
                current += 1
                if(current > maxPage) {
                    current = null
                } else {
                    current = current.toString()
                }
                let _urls = document.querySelectorAll("div#gdt a").map((e) => e.attributes["href"]).filter(Boolean)
                return {
                    thumbnails: images,
                    urls: _urls,
                    next: current
                }
            } finally {
                document.dispose()
            }
        },

        /**
         * rate a comic
         * @param id
         * @param rating {number} - [0-10] app use 5 stars, 1 rating = 0.5 stars,
         * @returns {Promise<any>}
         */
        starRating: async (id, rating) => {
            let res = await Network.post(this.apiUrl, {
                ...this.headers,
                'Content-Type': 'application/json'
            }, {
                'gid': this.parseUrl(id).id,
                'token': this.parseUrl(id).token,
                'method': 'rategallery',
                'rating': rating,
                'apikey': this.apiKey,
                'apiuid': this.uid,
            })
            if(res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            return 'ok'
        },

        getKey: async (url) => {
            let res = await Network.get(url, {
                ...this.headers,
                'cache-time': 'long',
                'prevent-parallel': 'true',
            })
            let document = new HtmlDocument(res.body)
            try {
                let script = document.querySelectorAll("script").find((e) => e.text.includes("showkey"));
                if(script) {
                    let reg = RegExp("showkey=\"(.*?)\"", "g");
                    let match = reg.exec(script.text)
                    if (match) {
                        return {
                            'showkey': match[1]
                        }
                    }
                }
                let mpvScript = document.querySelectorAll("script").find((e) => e.text.includes("mpvkey"))?.text;
                if(mpvScript) {
                    let mpvkey = mpvScript.split(';').find((e) => e.includes("mpvkey")).replaceAll(' ', '').split('=')[1].replaceAll('"', '');
                    let imageList = mpvScript.split(';').find((e) => e.includes("imagelist")).replaceAll(' ', '').split('=')[1];
                    return {
                        'mpvkey': mpvkey,
                        'imageKeys': JSON.parse(imageList).map((e) => e["k"])
                    }
                }
                throw "Failed to get key"
            } finally {
                document.dispose()
            }
        },
        /**
         * load images of a chapter
         * @param comicId {string}
         * @param epId {string?}
         * @returns {Promise<{images: string[]}>}
         */
        loadEp: async (comicId, epId) => {
            let comic = await this.comic.loadInfo(comicId)
            return {
                images: Array.from({length: comic.maxPage}, (_, i) => i.toString())
            }
        },
        /**
         * [Optional] provide configs for an image loading
         * @param image
         * @param comicId
         * @param epId
         * @param nl
         * @returns {{}}
         */
        onImageLoad: async (image, comicId, epId, nl) => {
            let first = await this.comic.loadThumbnails(comicId)
            let key = await this.comic.getKey(first.urls[0])
            let page = Number(image)

            let getImageFromApi = async (nl) => {
                if(key.mpvkey) {
                    let res = await Network.post(this.apiUrl, {
                        ...this.headers,
                        'Content-Type': 'application/json',
                    }, {
                        'gid': this.parseUrl(comicId).id,
                        "imgkey": key.imageKeys[page],
                        "method": "imagedispatch",
                        "page": Number(image) + 1,
                        "mpvkey": key.mpvkey,
                        "nl": nl,
                    })
                    let json = JSON.parse(res.body)
                    return {
                        url: json.i.toString(),
                        nl: json.s.toString()
                    }
                } else {
                    let parseImageKeyFromUrl = (url) => {
                        return url.split("/")[4]
                    }

                    let url = ''
                    if(page < first.thumbnails.length) {
                        url = first.urls[page]
                    } else {
                        let onePageLength = first.thumbnails.length
                        let shouldLoadPage = Math.floor(page / onePageLength)
                        let index = page % onePageLength
                        let thumbnails =
                            await this.comic.loadThumbnails(comicId, shouldLoadPage.toString())
                        url = thumbnails.urls[index]
                    }

                    let res = await Network.post(this.apiUrl, {
                        ...this.headers,
                        'Content-Type': 'application/json',
                    }, {
                        'gid': this.parseUrl(comicId).id,
                        "imgkey": parseImageKeyFromUrl(url),
                        "method": "showpage",
                        "page": page + 1,
                        "showkey": key.showkey,
                        "nl": nl,
                    })
                    let json = JSON.parse(res.body)
                    let i6 = json.i6
                    let reg = RegExp("nl\\('(.+?)'\\)").exec(i6)
                    nl = reg ? reg[1] : null
                    let imgHtml = json.i3
                    let imgUrl = imgHtml.substring(imgHtml.indexOf("src=\"") + 5, imgHtml.indexOf("\" style"))
                    return {
                        url: imgUrl,
                        nl: nl
                    }
                }
            }

            let res = await getImageFromApi(nl)

            let onLoadFailed = null

            if(res.nl) {
                onLoadFailed = async () => {
                    return this.comic.onImageLoad(image, comicId, epId, res.nl)
                }
            }

            return {
                url: res.url,
                headers: {
                    'referer': this.baseUrl,
                    'User-Agent': this.headers["User-Agent"],
                },
                onLoadFailed: onLoadFailed,
            }
        },
        /**
         * [Optional] provide configs for a thumbnail loading
         * @param url {string}
         * @returns {{}}
         */
        onThumbnailLoad: (url) => {
            if(url.includes('s.exhentai.org')) {
                url = url.replace("s.exhentai.org", "ehgt.org")
            }
            return {
                url: url,
                headers: {
                    'referer': this.baseUrl,
                    'User-Agent': this.headers["User-Agent"],
                }
            }
        },
        parseComments: (document) => {
            let comments = []
            for(let c of document.querySelectorAll('div.c1')) {
                let name = c.querySelector('div.c3 > a')?.text ?? ""
                let time = c.querySelector('div.c3')?.text?.split("Posted on")?.[1]?.split('by')?.[0]?.trim() ?? 'unknown'
                let content = ''
                if(typeof appVersion) {
                    content = c.querySelector('div.c6')?.innerHTML ?? ""
                } else {
                    content = c.querySelector('div.c6')?.text ?? ""
                }
                let score = Number(c.querySelector('div.c5 > span')?.text)
                if(isNaN(score)) {
                    score = null
                }
                let id = c.previousElementSibling?.attributes['name']?.match(/\d+/)?.[0] ?? '0'
                let isUp = (c.querySelector(`a#comment_vote_up_${id}`)?.attributes['style']?.length ?? 0) > 0
                let isDown = (c.querySelector(`a#comment_vote_down_${id}`)?.attributes['style']?.length ?? 0) > 0

                comments.push(new Comment({
                    id: id,
                    content: content,
                    time: time,
                    userName: name,
                    score: score,
                    voteStatus: isUp ? 1 : isDown ? -1 : 0,
                }))
            }

            return {
                comments: comments,
                maxPage: 1
            }
        },
        /**
         * [Optional] load comments
         * @param comicId {string}
         * @param subId {string?} - ComicDetails.subId
         * @param page {number}
         * @param replyTo {string?} - commentId to reply, not null when reply to a comment
         * @returns {Promise<{comments: Comment[], maxPage: number?}>}
         */
        loadComments: async (comicId, subId, page, replyTo) => {
            let res = await Network.get(`${comicId}?hc=1`, {
                ...this.headers,
                'cookie': 'nw=1'
            });
            if(res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body)
            try {
                return this.comic.parseComments(document)
            } finally {
                document.dispose()
            }
        },
        /**
         * [Optional] send a comment, return any value to indicate success
         * @param comicId {string}
         * @param subId {string?} - ComicDetails.subId
         * @param content {string}
         * @param replyTo {string?} - commentId to reply, not null when reply to a comment
         * @returns {Promise<any>}
         */
        sendComment: async (comicId, subId, content, replyTo) => {
            let res = await Network.post(comicId, {
                ...this.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'referer': comicId,
            }, `commenttext_new=${encodeURIComponent(content)}`)
            if(res.status >= 400) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body)
            try {
                let errEl = document.querySelector('p.br');
                if(errEl) {
                    throw errEl.text
                }
                return 'ok'
            } finally {
                document.dispose()
            }
        },
        /**
         * [Optional] vote a comment
         * @param id {string} - comicId
         * @param subId {string?} - ComicDetails.subId
         * @param commentId {string} - commentId
         * @param isUp {boolean} - true for up, false for down
         * @param isCancel {boolean} - true for cancel, false for vote
         * @returns {Promise<number>} - new score
         */
        voteComment: async (id, subId, commentId, isUp, isCancel) => {
            if(this.apiKey == null || this.uid == null) {
                throw "Login required"
            }

            let res = await Network.post(this.apiUrl, {
                ...this.headers,
                'Content-Type': 'application/json'
            }, {
                'gid': this.parseUrl(id).id,
                'token': this.parseUrl(id).token,
                'method': 'votecomment',
                'comment_id': commentId,
                'comment_vote': isUp ? 1 : -1,
                'apikey': this.apiKey,
                'apiuid': this.uid,
            })

            let json = JSON.parse(res.body)

            if(json.error) {
                throw json.error
            }

            return json.comment_score
        },
        archive: {
            getArchives: async (cid) => {
                let comicInfo = await this.comic.loadInfo(cid)
                let urlParseResult = this.parseUrl(cid)
                let gid = urlParseResult.id
                let token = urlParseResult.token
                let res = await Network.get(`${this.baseUrl}/archiver.php?gid=${gid}&token=${token}`, this.headers)
                if(res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }
                let document = new HtmlDocument(res.body)
                try {
                    let body = document.querySelector("div#db")
                    let index = this.baseUrl.includes("exhentai") ? 1 : 3
                    
                    let archives = []
                    
                    // Parse H@H Download options from the table
                    let hathTable = document.querySelector("table");
                    if (hathTable) {
                        let hathCells = hathTable.querySelectorAll("td");
                        for (let cell of hathCells) {
                            let link = cell.querySelector("a");
                            if (link) {
                                // Extract resolution from onclick attribute
                                let onclick = link.attributes["onclick"];
                                let resolutionMatch = onclick ? onclick.match(/do_hathdl\('([^']+)'\)/) : null;
                                if (resolutionMatch) {
                                    let resolution = resolutionMatch[1];
                                    let linkText = link.text;
                                    let paragraphs = cell.querySelectorAll("p");
                                    let size = paragraphs.length > 1 ? paragraphs[1].text : "Unknown";
                                    let cost = paragraphs.length > 2 ? paragraphs[2].text : "Unknown";
                                    
                                    archives.push({
                                        id: `h@h_${resolution}`,
                                        title: `H@H ${linkText}`,
                                        description: `Size: ${size}, Cost: ${cost}`,
                                    });
                                }
                            } else {
                                let paragraphs = cell.querySelectorAll("p");
                                if (paragraphs.length > 0) {
                                    let size = paragraphs.length > 1 ? paragraphs[1].text : "N/A";
                                    let cost = paragraphs.length > 2 ? paragraphs[2].text : "N/A";
                                    
                                    if (size !== "N/A" && cost !== "N/A") {
                                        let resolutionText = paragraphs[0].text;
                                        archives.push({
                                            id: `h@h_${resolutionText.toLowerCase().replace('x', '')}`,
                                            title: `H@H ${resolutionText}`,
                                            description: `Cost: ${cost}, Size: ${size}`,
                                        });
                                    }
                                }
                            }
                        }
                    }
                    
                    // Original Download
                    let origin = body?.children?.[index]?.children?.[0];
                    if (origin) {
                        let originCost = origin.querySelector("div > strong")?.text || "Unknown";
                        let originSize = origin.querySelector("p > strong")?.text || "Unknown";
                        archives.push({
                            id: '0',
                            title: 'Original',
                            description: `Cost: ${originCost}, Size: ${originSize}`,
                        });
                    }
                    
                    // Resample Download
                    let resample = body?.children?.[index]?.children?.[1];
                    if (resample) {
                        let resampleCost = resample.querySelector("div > strong")?.text || "Unknown";
                        let resampleSize = resample.querySelector("p > strong")?.text || "Unknown";
                        archives.push({
                            id: '1',
                            title: 'Resample',
                            description: `Cost: ${resampleCost}, Size: ${resampleSize}`,
                        });
                    }
                    
                    return archives
                } finally {
                    document.dispose()
                }
            },
            getDownloadUrl: async (cid, aid) => {
                let urlParseResult = this.parseUrl(cid)
                let gid = urlParseResult.id
                let token = urlParseResult.token
                
                // Handle H@H Download options
                if (aid.startsWith('h@h_')) {
                    let resolution = aid.substring(4); // Remove 'h@h_' prefix
                    
                    // For H@H downloads, send the command directly to archiver.php
                    let hathRes = await Network.post(`${this.baseUrl}/archiver.php?gid=${gid}&token=${token}`, {
                        ...this.headers,
                        "Content-Type": "application/x-www-form-urlencoded",
                    }, `hathdl_xres=${resolution}`)
                    
                    if (hathRes.status !== 200) {
                        throw `Failed to send H@H download command: ${hathRes.status}`
                    }
                    
                    // Parse response for any error messages
                    let hathDocument = new HtmlDocument(hathRes.body)
                    try {
                        let errorElement = hathDocument.querySelector("p.br")
                        if (errorElement) {
                            let errorMessage = errorElement.text
                            if (errorMessage.includes("H@H client")) {
                                throw "You need an H@H client associated with your account to use this feature"
                            } else if (errorMessage.includes("offline")) {
                                throw "Your H@H client appears to be offline. Please start it and try again"
                            } else if (errorMessage.includes("resolution")) {
                                throw "This gallery cannot be downloaded at the selected resolution"
                            } else {
                                throw errorMessage
                            }
                        }
                        
                        // Return empty string to avoid type error and prevent download task creation
                        return "";
                    } finally {
                        hathDocument.dispose()
                    }
                }
                
                // Handle regular downloads (Original and Resample)
                let data;
                switch(aid) {
                    case '0':
                        data = "dltype=org&dlcheck=Download+Original+Archive";
                        break;
                    case '1':
                        data = "dltype=res&dlcheck=Download+Resample+Archive";
                        break;
                    default:
                        throw "Invalid archive type";
                }
                
                let res = await Network.post(`${this.baseUrl}/archiver.php?gid=${gid}&token=${token}`, {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded",
                }, data)
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }
                let document = new HtmlDocument(res.body)
                let link = null
                try {
                    link = document.querySelector("a")?.attributes["href"]
                } finally {
                    document.dispose()
                }
                if(!link) {
                    throw "Failed to get download link"
                }
                let res2 = await Network.get(link, {
                    'http_client': 'dart:io',
                    'User-Agent': this.headers["User-Agent"]
                })
                let document2 = new HtmlDocument(res2.body)
                let link2 = null
                try {
                    link2 = document2.querySelector("a")?.attributes["href"]
                } finally {
                    document2.dispose()
                }
                function getHost(url) {
                    const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i;
                    const match = url.match(regex);
                    return match ? match[1] : null;
                }
                let host = getHost(link)
                let resultLink = "https://" + host + link2
                let test = await Network.sendRequest('HEAD', resultLink, {
                    'http_client': 'dart:io',
                    'User-Agent': this.headers["User-Agent"]
                }, null)
                if(test.status === 410) {
                    throw "IP quota exhausted."
                }
                return resultLink
            },
        },
        /**
         * [Optional] Handle tag click event
         * @param namespace {string}
         * @param tag {string}
         * @returns {{action: string, keyword: string, param: string?}}
         */
        onClickTag: (namespace, tag) => {
            if (namespace == "Category") {
                const categories = ["misc", "doujinshi", "manga", "artist cg", "game cg", "image set", "cosplay", "asian porn", "non-h", "western"];
                return {
                    page: "search",
                    attributes: {
                        'keyword': "",
                        'options': [categories.indexOf(tag.toLowerCase()).toString(), "", ""]
                    }
                };
            }
            if(tag.includes(' ')) {
                tag = `"${tag}"`
            }
            return {
                // 'search' or 'category'
                action: 'search',
                keyword: `${namespace}:${tag}`,
                // {string?} only for category action
                param: null,
            }
        },
        /**
         * [Optional] Handle links
         */
        link: {
            /**
             * set accepted domains
             */
            domains: [
                'e-hentai.org',
                'exhentai.org'
            ],
            /**
             * parse url to comic id
             * @param url {string}
             * @returns {string | null}
             */
            linkToId: (url) => {
                if(url.includes('?')) {
                    url = url.split('?')[0]
                }
                let reg = RegExp("https?://(e-|ex)hentai.org/g/(\\d+)/(\\w+)/?$")
                let match = reg.exec(url)
                if(match) {
                    return `${this.baseUrl}/g/${match[2]}/${match[3]}/`
                }
                return null
            }
        },
        enableTagsTranslate: true,
    }


    /*
    [Optional] settings related
    Use this.loadSetting to load setting
    ```
    let setting1Value = this.loadSetting('setting1')
    console.log(setting1Value)
    ```
     */
    settings = {
        domain: {
            // title
            title: "domain",
            // type: input, select, switch
            type: "select",
            // options
            options: [
                {
                    value: 'e-hentai.org',
                },
                {
                    value: 'exhentai.org',
                },
            ],
            default: 'e-hentai.org',
        },
        ehevent: {
            title: "ehevent",
            type: "switch",
            default: false
        },
        hvevent: {
            title: "hvevent",
            type: "switch",
            default: false
        },
    }

    // [Optional] translations for the strings in this config
    translation = {
        'zh_CN': {
            "domain": "域名",
            "ehevent": "触发黎明事件",
            "hvevent": "提示HV遭遇战",
            "hentaiverse": "你遇到了怪物！",
            "fight":"战斗",
            "cancel":"取消",
            "language": "语言",
            "artist": "画师",
            "male": "男性",
            "female": "女性",
            "mixed": "混合",
            "other": "其它",
            "parody": "原作",
            "character": "角色",
            "group": "团队",
            "cosplayer": "Coser",
            "reclass": "重新分类",
            "uploader": "上传者",
            "Languages": "语言",
            "Artists": "画师",
            "Characters": "角色",
            "Groups": "团队",
            "Tags": "标签",
            "Parodies": "原作",
            "Categories": "分类",
            "Category": "分类",
            "Min Stars": "最少星星",
            "Language": "语言",
            "H@H Original": "H@H 原版",
            "H@H 800x": "H@H 800x",
            "H@H 1280x": "H@H 1280x", 
            "H@H 1920x": "H@H 1920x",
            "H@H 2560x": "H@H 2560x",
            "Original": "原版",
            "Resample": "重采样",
            "popular": "最受欢迎",
            "watched": "我的关注",
            "Doujinshi": "同人志",
            "Manga": "单行本",
            "Artist CG": "画师CG",
            "Game CG": "游戏CG",
            "Western": "欧美",
            "Non-H": "非H",
            "Image Set": "图集",
            "Cosplay": "Cosplay",
            "Asian Porn": "亚洲色情",
            "Misc": "其他",
        },
        'zh_TW': {
            'domain': '域名',
            "ehevent": "觸發黎明事件",
            "hvevent": "提示HV遭遇戰",
            "hentaiverse": "你遇到了怪物！",
            "fight":"戰鬥",
            "cancel":"取消",
            "language": "語言",
            "artist": "畫師",
            "male": "男性",
            "female": "女性",
            "mixed": "混合",
            "other": "其他",
            "parody": "原作",
            "character": "角色",
            "group": "團隊",
            "cosplayer": "Coser",
            "reclass": "重新分類",
            "uploader": "上傳者",
            "Languages": "語言",
            "Artists": "畫師",
            "Characters": "角色",
            "Groups": "團隊",
            "Tags": "標籤",
            "Parodies": "原作",
            "Categories": "分類",
            "Category": "分類",
            "Min Stars": "最少星星",
            "Language": "語言",
            "H@H Original": "H@H 原版",
            "H@H 800x": "H@H 800x",
            "H@H 1280x": "H@H 1280x",
            "H@H 1920x": "H@H 1920x", 
            "H@H 2560x": "H@H 2560x",
            "Original": "原版",
            "Resample": "重採樣",
            "popular": "最受歡迎",
            "watched": "我的關注",
            "Doujinshi": "同人誌",
            "Manga": "單行本",
            "Artist CG": "畫師CG",
            "Game CG": "遊戲CG",
            "Western": "歐美",
            "Non-H": "非H",
            "Image Set": "圖集",
            "Cosplay": "Cosplay",
            "Asian Porn": "亞洲色情",
            "Misc": "其他",
        },
        'en_US': {
            "domain": "Domain",
            "ehevent": "Trigger Dawn Event",
            "hvevent": "HV Encounter Alert",
            "hentaiverse": "You have encountered a monster!",
            "fight": "Fight",
            "cancel": "Cancel",
            "language": "Language",
            "artist": "Artist",
            "male": "Male",
            "female": "Female",
            "mixed": "Mixed",
            "other": "Other",
            "parody": "Parody",
            "character": "Character",
            "group": "Group",
            "cosplayer": "Cosplayer",
            "reclass": "Reclass",
            "uploader": "Uploader",
            "Languages": "Languages",
            "Artists": "Artists",
            "Characters": "Characters",
            "Groups": "Groups",
            "Tags": "Tags",
            "Parodies": "Parodies",
            "Categories": "Categories",
            "Category": "Category",
            "Min Stars": "Min Stars",
            "Language": "Language",
            "H@H Original": "H@H Original",
            "H@H 800x": "H@H 800x",
            "H@H 1280x": "H@H 1280x",
            "H@H 1920x": "H@H 1920x",
            "H@H 2560x": "H@H 2560x",
            "Original": "Original",
            "Resample": "Resample",
            "popular": "Popular",
            "watched": "Watched",
            "Doujinshi": "Doujinshi",
            "Manga": "Manga",
            "Artist CG": "Artist CG",
            "Game CG": "Game CG",
            "Western": "Western",
            "Non-H": "Non-H",
            "Image Set": "Image Set",
            "Cosplay": "Cosplay",
            "Asian Porn": "Asian Porn",
            "Misc": "Misc",
        },
    }
}
