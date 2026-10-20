/** @type {import('./_venera_.js')} */

function isCloudflareChallenge(status, body) {
    if (status === 403 || status === 503) {
        if (
            body &&
            (body.indexOf("challenge-platform") !== -1 ||
                body.indexOf("cf-browser-verification") !== -1 ||
                body.indexOf("Just a moment") !== -1 ||
                body.indexOf("__cf_chl_") !== -1)
        ) {
            return true;
        }
    }
    return false;
}

function fitToRow(list, max) {
    if (!list || !list.length) return [];
    let limit = max && max < list.length ? max : list.length;
    limit = limit - (limit % 4);
    return list.slice(0, Math.max(limit, 0));
}

class HComic extends ComicSource {
    // Name of the source
    name = "H-Comic"

    // Unique id of the source
    key = "hcomic"

    version = "1.0.3"

    minAppVersion = "1.6.0"

    // Update url
    url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@hcomic-v1.0.3/hcomic.js"

    settings = {
        domain: {
            title: "域名设置",
            type: "input",
            default: "h-comic.com"
        }
    }

    get baseUrl() {
        let domain = "h-comic.com";
        try {
            domain = this.loadSetting("domain") || "h-comic.com";
        } catch (_) {
            domain = "h-comic.com";
        }
        const cleanDomain = String(domain).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        return `https://${cleanDomain}`;
    }

    get headers() {
        return {
            "http_client": "dart:io",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": `${this.baseUrl}/`,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        };
    }

    /**
     * [Optional] init function
     */
    init() {

    }

    account = {
        loginWithWebview: {
            url: "https://h-comic.com",
            checkStatus: (url, title) => {
                return (
                    !title.includes("Just a moment") &&
                    !title.includes("Cloudflare") &&
                    !title.includes("Attention Required")
                );
            },
            onLoginSuccess: () => {},
        },
    }

    async getHtml(url) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                let res = await Network.get(url, this.headers);
                if (isCloudflareChallenge(res.status, res.body)) {
                    throw "Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成人机验证后再试。";
                }
                if (res.status === 200) {
                    return res.body;
                }
                if (attempt === 1) {
                    throw `网络请求失败 (状态码: ${res.status})`;
                }
            } catch (e) {
                if (attempt === 1 || String(e).includes("Cloudflare")) {
                    throw e;
                }
            }
        }
    }

    extractData(html) {
        // Look for the SvelteKit data script
        // Matches: data: [null, { ... }], form:
        let match = html.match(/data:\s*\[null,\s*(\{[\s\S]*?\})\s*\]\s*,\s*form:/);
        if (match) {
            let jsonStr = match[1];
            try {
                // Try to fix unquoted keys: { key: value } -> { "key": value }
                let fixedJsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
                let json = JSON.parse(fixedJsonStr);
                return json.data;
            } catch (e) {
                try {
                    // Fallback to new Function if JSON.parse fails (e.g. trailing commas)
                    let fn = new Function("return " + jsonStr);
                    let json = fn();
                    return json.data;
                } catch (e2) {
                    console.error("Failed to eval SvelteKit data", e2);
                }
            }
        }
        return null;
    }

    extractMaxPage(html, data) {
        if (data && data.pages && typeof data.pages.pages === "number") {
            const p = data.pages.pages;
            if (!isNaN(p) && p > 0) return p;
        }
        let match = html && html.match(/name="page"[^>]*max="(\d+)"/);
        if (match) {
            let n = parseInt(match[1]);
            if (!isNaN(n) && n > 0) return n;
        }
        return 1;
    }

    parseComic(c) {
        let title = c.title ? (c.title.display || c.title.pretty || c.title.japanese || c.title.english || "") : "";
        let tags = [];
        let updateTime = null;

        if (c.tags && Array.isArray(c.tags)) {
            for (let t of c.tags) {
                let name = t.name_zh || t.name;
                if (name) tags.push(name);
            }
        }

        if (c.upload_date) {
            let date = new Date(c.upload_date * 1000).toISOString().split('T')[0];
            tags.push(date);
            updateTime = date;
        }

        return new Comic({
            id: `${c.id}|${title}`,
            title: title,
            subTitle: c.title ? c.title.english : "",
            cover: c.thumbnail || (c.comic_source && c.media_id ? `https://h-comic.link/api/${c.comic_source}/${c.media_id}/pages/1` : ""),
            tags: tags,
            description: (c.title && c.title.japanese) ? c.title.japanese : "",
            updateTime: updateTime
        });
    }

    // explore page list (single tab, prioritized to homepage list)
    explore = [
        {
            // title of the page.
            title: "H-Comic",

            /// multiPartPage or multiPageComicList or mixed
            type: "multiPageComicList",

            load: async (page) => {
                if (!page || page < 1) page = 1;
                let url = page === 1 ? `${this.baseUrl}/` : `${this.baseUrl}/?page=${page}`;
                let html = await this.getHtml(url);
                let data = this.extractData(html);
                if (!data || !data.comics) {
                    return { comics: [], maxPage: page };
                }

                let comics = data.comics.map(c => this.parseComic(c));
                let maxPage = this.extractMaxPage(html, data);

                return {
                    comics: comics,
                    maxPage: maxPage
                };
            }
        }
    ]

    // categories
    category = {
        /// title of the category page
        title: "H-Comic",
        parts: [
            {
                // title of the part
                name: "热门TAG",

                // fixed or random or dynamic
                type: "fixed",

                categories: [
                    { label: "全部", target: { page: "category", attributes: { category: "全部" } } },
                    { label: "全彩", target: { page: "category", attributes: { category: "全彩", param: "全彩" } } },
                    { label: "無修正", target: { page: "category", attributes: { category: "無修正", param: "無修正" } } },
                    { label: "蘿莉", target: { page: "category", attributes: { category: "蘿莉", param: "蘿莉" } } },
                    { label: "制服", target: { page: "category", attributes: { category: "制服", param: "制服" } } },
                    { label: "巨乳", target: { page: "category", attributes: { category: "巨乳", param: "巨乳" } } },
                    { label: "黑絲 / 白襪", target: { page: "category", attributes: { category: "黑絲 / 白襪", param: "黑絲 / 白襪" } } },
                    { label: "NTR", target: { page: "category", attributes: { category: "NTR", param: "netorare" } } },
                    { label: "足交 / 腳交", target: { page: "category", attributes: { category: "足交 / 腳交", param: "footjob" } } },
                    { label: "女學生", target: { page: "category", attributes: { category: "女學生", param: "女學生" } } },
                    { label: "眼鏡控", target: { page: "category", attributes: { category: "眼鏡控", param: "眼鏡控" } } },
                    { label: "口交", target: { page: "category", attributes: { category: "口交", param: "口交" } } },
                    { label: "正太控", target: { page: "category", attributes: { category: "正太控", param: "正太控" } } },
                    { label: "年上", target: { page: "category", attributes: { category: "年上", param: "年上" } } },
                    { label: "亂倫", target: { page: "category", attributes: { category: "亂倫", param: "亂倫" } } },
                    { label: "熟女 / 人妻", target: { page: "category", attributes: { category: "熟女 / 人妻", param: "熟女 / 人妻" } } },
                    { label: "同志 BL", target: { page: "category", attributes: { category: "同志 BL", param: "同志 BL" } } },
                    { label: "黑肉", target: { page: "category", attributes: { category: "黑肉", param: "黑肉" } } },
                    { label: "泳裝", target: { page: "category", attributes: { category: "泳裝", param: "泳裝" } } },
                    { label: "手淫", target: { page: "category", attributes: { category: "手淫", param: "手淫" } } },
                    { label: "肌肉", target: { page: "category", attributes: { category: "肌肉", param: "肌肉" } } },
                    { label: "姐姐 / 妹妹", target: { page: "category", attributes: { category: "姐姐 / 妹妹", param: "姐姐 / 妹妹" } } },
                    { label: "捆綁", target: { page: "category", attributes: { category: "捆綁", param: "捆綁" } } },
                    { label: "調教", target: { page: "category", attributes: { category: "調教", param: "調教" } } },
                    { label: "催眠", target: { page: "category", attributes: { category: "催眠", param: "催眠" } } },
                    { label: "露出", target: { page: "category", attributes: { category: "露出", param: "露出" } } },
                    { label: "群交", target: { page: "category", attributes: { category: "群交", param: "群交" } } },
                    { label: "肛交", target: { page: "category", attributes: { category: "肛交", param: "肛交" } } },
                    { label: "獸交", target: { page: "category", attributes: { category: "獸交", param: "獸交" } } }
                ]
            }
        ],
        // enable ranking page
        enableRankingPage: false,
    }

    /// category comic loading related
    categoryComics = {
        /**
         * load comics of a category
         * @param category {string} - category name
         * @param param {string?} - category param
         * @param options {string[]} - options from optionList
         * @param page {number} - page number
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        load: async (category, param, options, page) => {
            if (!page || page < 1) page = 1;
            let sort = (options && options[0]) ? options[0] : "latest";
            let path = sort === "random" ? "/random" : "/";
            
            let url = `${this.baseUrl}${path}?page=${page}`;

            if (param) {
                url += `&tag=${encodeURIComponent(param)}`;
            }

            let html = await this.getHtml(url);
            let data = this.extractData(html);
            let maxPage = sort === "random" ? 1 : this.extractMaxPage(html, data);

            if (!data || !data.comics) return { comics: [], maxPage: page };

            let comics = data.comics.map(c => this.parseComic(c));
            
            return {
                comics: comics,
                maxPage: maxPage
            };
        },
        // [Optional] provide options for category comic loading
        optionList: [
            {
                options: [
                    "latest-最近更新",
                    "random-随机刷新"
                ]
            }
        ],
        ranking: {
            options: [],
            load: async (option, page) => {
                return { comics: [], maxPage: 0 };
            }
        }
    }

    /// search related
    search = {
        /**
         * load search result
         * @param keyword {string}
         * @param options {string[]} - options from optionList
         * @param page {number}
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        load: async (keyword, options, page) => {
            if (!keyword || !keyword.trim()) {
                return { comics: [], maxPage: 1 };
            }
            if (!page || page < 1) page = 1;

            let url = `${this.baseUrl}/?q=${encodeURIComponent(keyword.trim())}&page=${page}`;
            let html = await this.getHtml(url);
            let data = this.extractData(html);
            let maxPage = this.extractMaxPage(html, data);

            if (!data || !data.comics) return { comics: [], maxPage: page };

            let comics = data.comics.map(c => this.parseComic(c));

            return { comics, maxPage };
        },
        optionList: [],
        enableTagsSuggestions: false,
    }

    /// single comic related
    comic = {
        loadInfo: async (id) => {
            let realId = id;
            let title_temp = "view";
            if (id.includes('|')) {
                let parts = id.split('|');
                realId = parts[0];
                title_temp = parts.slice(1).join('|');
            }

            let url = `${this.baseUrl}/comics/${encodeURIComponent(title_temp)}/1?id=${realId}`;
            let html = await this.getHtml(url);
            let data = this.extractData(html);
            
            if (!data || !data.comic) throw "获取漫画详情失败";
            let c = data.comic;

            let title = c.title ? (c.title.display || c.title.pretty || c.title.japanese || c.title.english || "") : "";
            let subTitle = c.title ? c.title.english : "";
            
            let cover = c.thumbnail;
            if (!cover && c.comic_source && c.media_id) {
                cover = `https://h-comic.link/api/${c.comic_source}/${c.media_id}/pages/1`;
            }

            const typeMap = {
                parody: "原作",
                artist: "作者",
                group: "社團",
                tag: "標籤",
                language: "語言",
                category: "分類"
            };

            let tags = {};
            if (c.tags && Array.isArray(c.tags)) {
                for (let t of c.tags) {
                    let groupName = (t.type && typeMap[t.type]) ? typeMap[t.type] : "標籤";
                    let val = t.name_zh || t.name;
                    if (val) {
                        if (!tags[groupName]) tags[groupName] = [];
                        tags[groupName].push(val);
                    }
                }
            }
            
            let updateTime = null;
            if (c.upload_date) {
                let date = new Date(c.upload_date * 1000).toISOString().split('T')[0];
                tags["日期"] = [date];
                updateTime = date;
            }

            let description = (c.title && c.title.japanese) ? c.title.japanese : "";

            // Encode source, media_id, num_pages into chapter ID
            let chapterId = `${c.comic_source}|${c.media_id}|${c.num_pages}`;

            let chapters = new Map();
            let group = new Map();
            group.set(chapterId, "全一话");
            chapters.set("章节", group);

            return new ComicDetails({
                title: title,
                subTitle: subTitle,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                updateTime: updateTime
            });
        },
        loadEp: async (comicId, epId) => {
            let parts = epId.split('|');
            let source = parts[0];
            let mediaId = parts[1];
            let numPages = parseInt(parts[2]);

            if (isNaN(numPages) || numPages < 1) {
                numPages = 1;
            }

            let images = [];
            for (let i = 1; i <= numPages; i++) {
                images.push(`https://h-comic.link/api/${source}/${mediaId}/pages/${i}`);
            }

            return { images: images };
        },
        onImageLoad: (url, comicId, epId) => ({
            url: url,
            headers: {
                "http_client": "dart:io",
                "Referer": `${this.baseUrl}/`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            }
        }),
        onThumbnailLoad: (url) => ({
            url: url,
            headers: {
                "http_client": "dart:io",
                "Referer": `${this.baseUrl}/`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            }
        }),
        onClickTag: (namespace, tag) => {
            return {
                page: "category",
                attributes: {
                    category: "tag",
                    param: tag
                }
            };
        },
        link: {
            domains: ['h-comic.com', 'h-comic.link'],
            linkToId: (url) => {
                let idMatch = url.match(/id=(\d+)/);
                let titleMatch = url.match(/\/comics\/([^/]+)/);
                if (idMatch) {
                    let id = idMatch[1];
                    let title = titleMatch ? decodeURIComponent(titleMatch[1]) : "view";
                    return `${id}|${title}`;
                }
                return null;
            }
        },
        enableTagsTranslate: false,
    }
}
