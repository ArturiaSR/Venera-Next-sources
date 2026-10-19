/**
 * 百年漫画 - VeneraNext JS 图源
 *
 * 移植自 Cimoc JSON 配置 (BAINIANMH)
 * 站点: https://m.bnman.net (当前 302 重定向到主站，实际可达)
 * 验证时间: 2026-09-19 (HTTP 302, 重定向后可访问)
 *
 * 反爬: 图片需要 Referer 防盗链
 */

class BainianMH extends ComicSource {
    name = "百年漫画";
    key = "bainianmh";
    version = "1.0.0";
    minAppVersion = "1.6.0";
    url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/bainianmh.js";

    settings = {
        domain: {
            title: "站点域名",
            type: "select",
            options: [
                { value: "https://m.bnman.net", text: "m.bnman.net (移动端)" },
                { value: "https://www.bnman.net", text: "www.bnman.net (PC端)" },
            ],
            default: "https://m.bnman.net",
        },
        image_domain: {
            title: "图片CDN",
            type: "select",
            options: [
                { value: "", text: "默认 (站方自动)" },
                { value: "https://cdn.bnman.net/", text: "cdn.bnman.net" },
                { value: "https://img.bnman.net/", text: "img.bnman.net" },
            ],
            default: "",
        },
    };

    get baseUrl() {
        return this.loadSetting("domain") || this.settings.domain.default;
    }

    get imgServer() {
        return this.loadSetting("image_domain") || "";
    }

    get ua() {
        return "Mozilla/5.0 (Linux; Android 13; SM-S9080) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    }

    get headers() {
        return {
            "User-Agent": this.ua,
            "Referer": this.baseUrl + "/",
        };
    }

    // ─── 解析工具 ────────────────────────────────────────────
    parseComic(e) {
        let title = "";
        let cover = "";
        let author = "";
        let update = "";
        let id = "";
        let href = "";

        try {
            let a = e.querySelector("a");
            href = a ? a.attributes["href"] : "";
            title = e.querySelector("h4 > a, h3 a, .book-title a") ?
                (e.querySelector("h4 > a, h3 a, .book-title a").text.trim()) : (a ? a.text.trim() : "");

            let img = e.querySelector("mip-img, img");
            if (img) cover = img.attributes["src"] || img.attributes["data-src"] || "";

            let authorEl = e.querySelector("p.dir, .author, .book-author");
            author = authorEl ? authorEl.text.trim() : "";

            let updateEl = e.querySelector("h4.h4.red, .update, .update-time");
            update = updateEl ? updateEl.text.trim() : "";
        } catch (ex) { /* silent */ }

        if (href) {
            id = href.replace(/^\//, "").split("/").pop().replace(".html", "").replace(".htm", "");
        }

        return {
            id: id,
            title: title,
            subTitle: author,
            cover: this.fixUrl(cover),
            tags: [],
            description: update,
        };
    }

    fixUrl(url) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("//")) return "https:" + url;
        return this.baseUrl.replace(/\/$/, "") + "/" + url.replace(/^\//, "");
    }

    // ─── 搜索 ────────────────────────────────────────────────
    search = {
        load: async (keyword, options, page) => {
            let searchUrl = `${this.baseUrl}/search/${encodeURIComponent(keyword)}/${page}.html`;
            let res = await Network.get(searchUrl, this.headers);
            if (res.status !== 200 && res.status !== 301 && res.status !== 302) {
                throw `搜索失败: HTTP ${res.status}`;
            }

            let doc = new HtmlDocument(res.body);
            let items = doc.querySelectorAll("ul.tbox_m > li");
            let comics = [];
            for (let item of items) {
                let comic = this.parseComic(item);
                if (comic.title && comic.id) {
                    comics.push(comic);
                }
            }

            let maxPage = comics.length > 0 ? page + 1 : page;
            return { comics: comics, maxPage: maxPage };
        },
        optionList: [],
    };

    // ─── 探索页 ──────────────────────────────────────────────
    explore = [
        {
            title: "百年漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                let res = await Network.get(this.baseUrl, this.headers);
                if (res.status !== 200) {
                    throw `首页加载失败: HTTP ${res.status}`;
                }

                let doc = new HtmlDocument(res.body);
                let parts = {};

                // 尝试解析首页推荐区块
                let lists = doc.querySelectorAll("div.tbox_m, .recommend-list, .comic-list");
                let idx = 0;
                for (let list of lists) {
                    let titleEl = list.querySelector("h3, h2, .title, .more");
                    let partTitle = titleEl ? titleEl.text.trim() : `推荐${++idx}`;
                    let items = list.querySelectorAll("li");
                    let comics = [];
                    for (let item of items) {
                        let comic = this.parseComic(item);
                        if (comic.title) comics.push(comic);
                    }
                    if (comics.length > 0) {
                        parts[partTitle] = comics;
                    }
                }

                // 备用解析
                if (Object.keys(parts).length === 0) {
                    let allItems = doc.querySelectorAll("ul.tbox_m > li, .comic_list li, .list li");
                    let comics = [];
                    for (let item of allItems) {
                        let comic = this.parseComic(item);
                        if (comic.title) comics.push(comic);
                    }
                    if (comics.length > 0) parts["推荐"] = comics;
                }

                return parts;
            }
        }
    ];

    // ─── 分类 ────────────────────────────────────────────────
    category = {
        title: "百年漫画分类",
        parts: [
            {
                name: "全部",
                type: "fixed",
                categories: [
                    { label: "热门", target: { page: "category", attributes: { category: "热门", param: "hot" } } },
                    { label: "最新", target: { page: "category", attributes: { category: "最新", param: "new" } } },
                    { label: "完结", target: { page: "category", attributes: { category: "完结", param: "complete" } } },
                ],
            }
        ],
        enableRankingPage: false,
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            let url;
            if (param === "hot") {
                url = `${this.baseUrl}/top/`;
            } else if (param === "new") {
                url = `${this.baseUrl}/update/`;
            } else if (param === "complete") {
                url = `${this.baseUrl}/complete/`;
            } else {
                url = `${this.baseUrl}/`;
            }

            let res = await Network.get(url, this.headers);
            if (res.status !== 200) {
                throw `分类加载失败: HTTP ${res.status}`;
            }

            let doc = new HtmlDocument(res.body);
            let items = doc.querySelectorAll("ul.tbox_m > li, .list li, div.comic_list li");
            let comics = [];
            for (let item of items) {
                let comic = this.parseComic(item);
                if (comic.title) comics.push(comic);
            }

            return { comics: comics, maxPage: 1 };
        },
        optionList: [],
    };

    // ─── 漫画详情 ────────────────────────────────────────────
    comic = {
        loadInfo: async (id) => {
            let comicUrl = `${this.baseUrl}/${id}`;
            let res = await Network.get(comicUrl, this.headers);
            if (res.status !== 200) {
                comicUrl = `${this.baseUrl}/comic/${id}.html`;
                res = await Network.get(comicUrl, this.headers);
                if (res.status !== 200) {
                    throw `详情加载失败: HTTP ${res.status}`;
                }
            }

            let doc = new HtmlDocument(res.body);

            let title = doc.querySelector("div.dbox > div.data > h4, h1, .book-title h1") ?
                (doc.querySelector("div.dbox > div.data > h4, h1, .book-title h1").text.trim()) : "";
            let cover = "";
            let coverEl = doc.querySelector("div.dbox > div.img > mip-img, .book-cover img, img.cover");
            if (coverEl) cover = coverEl.attributes["src"] || coverEl.attributes["data-src"] || "";

            let intro = doc.querySelector("div.tbox_js, .book-intro, .intro") ?
                doc.querySelector("div.tbox_js, .book-intro, .intro").text.trim() : "";
            let author = doc.querySelector("div.dbox > div.data > p.dir, .author") ?
                doc.querySelector("div.dbox > div.data > p.dir, .author").text.trim() : "";
            let update = doc.querySelector("div.dbox > div.data > p.act, .update") ?
                doc.querySelector("div.dbox > div.data > p.act, .update").text.trim() : "";
            let status = doc.querySelector("span.list_item, .status, .tag") ?
                doc.querySelector("span.list_item, .status, .tag").text.trim() : "";

            cover = this.fixUrl(cover);

            // 章节列表
            let chapters = new Map();
            let i = 0;
            let chapterSelectors = [
                "div.tabs_block > ul.list_block > li > a:not([target])",
                "ul.catalog-list > li > a",
                "div.book-detail > ul > li > a",
                "#chapter-list li a",
            ];
            for (let sel of chapterSelectors) {
                let chapterItems = doc.querySelectorAll(sel);
                if (chapterItems.length > 0) {
                    for (let a of chapterItems) {
                        let chTitle = a.text.trim();
                        if (chTitle) {
                            chapters.set(i.toString(), chTitle);
                            i++;
                        }
                    }
                    break;
                }
            }

            // 标签
            let tags = {};
            if (author) tags["作者"] = [author];
            if (status) tags["状态"] = [status];

            return new ComicDetails({
                title: title,
                cover: cover,
                description: intro,
                tags: tags,
                chapters: chapters,
                recommend: [],
                updateTime: update,
            });
        },

        loadEp: async (comicId, epId) => {
            let chapterUrl = `${this.baseUrl}/read/${comicId}_${epId}.html`;
            let res = await Network.get(chapterUrl, this.headers);
            if (res.status !== 200) {
                chapterUrl = `${this.baseUrl}/${comicId}_${epId}`;
                res = await Network.get(chapterUrl, this.headers);
                if (res.status !== 200) {
                    throw `章节加载失败: HTTP ${res.status}`;
                }
            }

            let images = [];
            let html = res.body;

            // 尝试从JS变量提取
            let cpMatch = html.match(/cp\s*=\s*["'](\[.*?\])/);
            if (cpMatch) {
                try {
                    let imgs = JSON.parse(cpMatch[1].replace(/'/g, '"'));
                    for (let img of imgs) {
                        let imgStr = String(img);
                        if (imgStr.startsWith("/")) imgStr = this.fixUrl(imgStr);
                        images.push(imgStr);
                    }
                } catch (e) { /* fallback */ }
            }

            // HTML img 提取
            if (images.length === 0) {
                let doc = new HtmlDocument(html);
                let imgNodes = doc.querySelectorAll(".reader-area img, .chapter-img, #img-list img, .comic-contain img");
                for (let img of imgNodes) {
                    let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
                    if (src && !src.includes("data:image")) {
                        images.push(this.fixUrl(src));
                    }
                }
            }

            // 正则提取
            if (images.length === 0) {
                let imgRegex = html.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)[^\s"'<>]*/gi);
                if (imgRegex) {
                    images = imgRegex.filter(u => !u.includes("logo") && !u.includes("icon"));
                }
            }

            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            let imgHost = url.split("/")[2] || "";
            return {
                headers: {
                    "User-Agent": this.ua,
                    "Referer": `https://${imgHost}/`,
                },
            };
        },

        onThumbnailLoad: (url) => {
            return {};
        },

        link: {
            domains: ["bnman.net", "m.bnman.net", "www.bnman.net"],
            linkToId: (url) => {
                let match = url.match(/\/([\d\w-]+)(?:_\d+)?\.?html?$/);
                return match ? match[1] : null;
            }
        },

        idMatch: "^(\\d+|[\\w-]+)$",
        enableTagsTranslate: false,
    };

    translation = {
        "zh_CN": {
            "站点域名": "站点域名",
            "图片CDN": "图片CDN",
        },
        "zh_TW": {},
        "en": {}
    };
}