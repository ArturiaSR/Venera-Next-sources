/** @type {import('./_venera_.js')} */

const BASE_URL = "https://mycomic.com/cn";
const CDN_URL = "https://biccam.com";
const REFERER = "https://mycomic.com/";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const headers = {
    "User-Agent": UA,
    "Referer": REFERER,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
};

/**
 * Check if the response is a Cloudflare challenge page
 * @param {number} status
 * @param {string} body
 * @returns {boolean}
 */
function isCloudflareChallenge(status, body) {
    if (status === 403 || status === 503) {
        if (body && (body.indexOf("challenge-platform") !== -1 ||
            body.indexOf("cf-browser-verification") !== -1 ||
            body.indexOf("Just a moment") !== -1 ||
            body.indexOf("__cf_chl_") !== -1)) {
            return true;
        }
        return true;
    }
    if (body && body.indexOf("challenge-platform") !== -1) {
        return true;
    }
    return false;
}

/**
 * Wrapper for Network.get that detects Cloudflare challenges
 * and throws a user-friendly error guiding them to login
 * @param {string} url
 * @returns {Promise<{status: number, headers: object, body: string}>}
 */
async function fetchWithCFCheck(url) {
    const resp = await Network.get(url, headers);
    if (isCloudflareChallenge(resp.status, resp.body)) {
        throw "Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成一次 Cloudflare 验证后即可正常使用。";
    }
    return resp;
}

/**
 * Extract meta tag content from raw HTML
 * @param {string} html
 * @param {string} name - meta name or property (e.g. "description", "og:title")
 * @returns {string|null}
 */
function getMetaContent(html, name) {
    // pattern 1: <meta name="x" content="y"> or <meta property="x" content="y">
    let m = new RegExp(
        "<meta[^>]*?(?:name|property)=['\"]" + escapeRegex(name) + "['\"][^>]*?content=['\"]([^'\"]*)['\"]",
        "i"
    ).exec(html);
    if (m) return m[1];
    // pattern 2: <meta content="y" name="x"> or <meta content="y" property="x">
    m = new RegExp(
        "<meta[^>]*?content=['\"]([^'\"]*)['\"][^>]*?(?:name|property)=['\"]" + escapeRegex(name) + "['\"]",
        "i"
    ).exec(html);
    if (m) return m[1];
    return null;
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Safely extract cover image URL from an HtmlElement
 * @param {HtmlElement|null} img
 * @returns {string}
 */
function extractCoverFromImg(img) {
    if (!img) return "";
    let cover = img.attributes["data-src"] ||
        img.attributes["data-cfsrc"] ||
        img.attributes["data-original"] ||
        img.attributes["data-lazy-src"] ||
        "";
    if (!cover) {
        let src = img.attributes["src"] || "";
        if (src && !src.startsWith("data:") && src.indexOf("placeholder") === -1 && src.indexOf("loading") === -1) {
            cover = src;
        }
    }
    if (!cover) {
        let srcset = img.attributes["data-srcset"] || img.attributes["srcset"] || "";
        if (srcset) {
            let first = srcset.split(",")[0].trim().split(" ")[0];
            if (first && !first.startsWith("data:")) cover = first;
        }
    }
    if (cover) {
        cover = cover.replace(/&amp;/g, "&").trim();
        if (cover.startsWith("//")) {
            cover = "https:" + cover;
        } else if (cover.startsWith("/") && (cover.indexOf("biccam.com") !== -1 || cover.indexOf("/comics/") !== -1 || cover.indexOf("/chapters/") !== -1)) {
            cover = CDN_URL + cover;
        } else if (cover.startsWith("/")) {
            cover = "https://mycomic.com" + cover;
        }
    }
    return cover;
}

/**
 * Parse comic card from an <a> element
 * @param {HtmlElement} a
 * @returns {Comic|null}
 */
function parseComicCard(a) {
    const href = a.attributes["href"] || "";
    const match = /\/comics\/(\d+)/.exec(href);
    if (!match) return null;
    const id = match[1];

    // Try finding img inside a, or as sibling/parent
    let img = a.querySelector("img");
    let cover = extractCoverFromImg(img);

    if (!cover && a.parent) {
        img = a.parent.querySelector("img");
        cover = extractCoverFromImg(img);
    }
    if (!cover && a.parent && a.parent.parent) {
        img = a.parent.parent.querySelector("img");
        cover = extractCoverFromImg(img);
    }

    let title = img ? (img.attributes["alt"] || "").trim() : "";
    if (!title) {
        title = a.text.trim();
    }
    if (!title && a.parent) {
        const titleEl = a.parent.querySelector("h3, h4, div.font-bold, div.font-medium, span.title, div.truncate");
        if (titleEl) {
            title = titleEl.text.trim();
        }
    }
    if (!title) title = id;

    let description = "";
    const chapterDiv = a.querySelector("div.truncate, span.truncate") ||
        (a.parent ? a.parent.querySelector("div.truncate, span.truncate") : null);
    if (chapterDiv) {
        description = chapterDiv.text.trim();
    }

    return new Comic({
        id: id,
        title: title,
        cover: cover,
        description: description,
        language: "zh-Hans",
    });
}

/**
 * Parse comic list from an HtmlDocument or HtmlElement
 * @param {HtmlDocument|HtmlElement} root
 * @param {boolean} [dedup=true]
 * @returns {Comic[]}
 */
function parseComicList(root, dedup = true) {
    if (!root) return [];
    const links = root.querySelectorAll("a[href*='/comics/']");
    const comics = [];
    const seen = new Set();

    for (let i = 0; i < links.length; i++) {
        const comic = parseComicCard(links[i]);
        if (!comic) continue;
        if (dedup) {
            if (seen.has(comic.id)) continue;
            seen.add(comic.id);
        }
        comics.push(comic);
    }

    return comics;
}

/**
 * Parse all comic cards preserving order without global cross-section deduplication
 * @param {HtmlDocument|HtmlElement} root
 * @returns {Comic[]}
 */
function parseAllComicCards(root) {
    if (!root) return [];
    const links = root.querySelectorAll("a[href*='/comics/']");
    const comics = [];
    for (let i = 0; i < links.length; i++) {
        const c = parseComicCard(links[i]);
        if (!c) continue;
        if (comics.length > 0 && comics[comics.length - 1].id === c.id) continue;
        comics.push(c);
    }
    return comics;
}

/**
 * Extract max page number from pagination links in raw HTML
 * @param {string} html
 * @returns {number}
 */
function parseMaxPage(html) {
    const pageMatches = html.match(/(?:href="[^"]*page=)(\d+)/g);
    if (!pageMatches) return 1;
    let max = 1;
    pageMatches.forEach((m) => {
        const n = parseInt(m.replace(/.*page=/, ""), 10);
        if (!isNaN(n) && n > max) max = n;
    });
    return max;
}

/**
 * Build a comics listing URL with optional filters
 * @param {number} page
 * @param {string} sort - sort param (e.g. "-update", "-views", "-id")
 * @param {string} q - search keyword
 * @param {string} filterType - "tag" | "country" | "audience" | "year" | "end"
 * @param {string} filterValue - filter value
 * @returns {string}
 */
function buildComicsUrl(page, sort, q, filterType, filterValue) {
    const params = [];
    if (q) params.push("q=" + encodeURIComponent(q));
    if (sort) params.push("sort=" + sort);
    if (filterType && filterValue) {
        params.push("filter[" + filterType + "]=" + filterValue);
    }
    if (page && page > 1) params.push("page=" + page);
    const query = params.join("&");
    return BASE_URL + "/comics" + (query ? "?" + query : "");
}

class MyComic extends ComicSource {
    name = "MYCOMIC";

    key = "mycomic";

    version = "1.1.4";

    minAppVersion = "1.4.6";

    url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/mycomic.js";

    init() {
        // Check if cf_clearance cookie exists; if not, the user may need to "login"
        const cookies = Network.getCookies("https://mycomic.com");
        let hasCfClearance = false;
        if (cookies && cookies.length > 0) {
            for (let i = 0; i < cookies.length; i++) {
                if (cookies[i].name === "cf_clearance") {
                    hasCfClearance = true;
                    break;
                }
            }
        }
        if (!hasCfClearance) {
            console.log("[MyComic] No cf_clearance cookie found. User may need to login.");
        }
    }

    // ==================== Account (Cloudflare bypass) ====================

    account = {
        // Method 1: WebView login - opens mycomic.com in a real browser engine
        // The browser will automatically solve Cloudflare's JS challenge,
        // and the resulting cf_clearance cookie will be stored for Network requests.
        loginWithWebview: {
            url: "https://mycomic.com/cn",
            checkStatus: (url, title) => {
                // Cloudflare challenge page has title "Just a moment..." or similar
                // After the challenge is passed, the real site loads
                if (!url || !title) return false;
                if (title.indexOf("moment") !== -1) return false;
                if (title.indexOf("Cloudflare") !== -1) return false;
                if (title.indexOf("challenge") !== -1) return false;
                // Success: we're on the actual mycomic.com page
                if (url.indexOf("mycomic.com") !== -1) return true;
                return false;
            },
            onLoginSuccess: () => {
                // Cookies from WebView should be synced with Network API automatically.
                // Log for debugging.
                const cookies = Network.getCookies("https://mycomic.com");
                console.log("[MyComic] Login success. Cookies: " + (cookies ? cookies.length : 0));
            },
        },

        // Method 2: Manual cookie input - user can paste cf_clearance value
        // obtained from their browser's dev tools
        loginWithCookies: {
            fields: ["cf_clearance"],
            validate: async (values) => {
                if (!values || !values[0]) return false;
                // Set the cf_clearance cookie
                Network.setCookies("https://mycomic.com", [
                    new Cookie({
                        name: "cf_clearance",
                        value: values[0],
                        domain: ".mycomic.com",
                    }),
                ]);
                // Validate by trying to fetch the homepage
                try {
                    const resp = await Network.get(
                        "https://mycomic.com/cn",
                        headers
                    );
                    return resp.status === 200 &&
                        !isCloudflareChallenge(resp.status, resp.body);
                } catch (e) {
                    return false;
                }
            },
        },

        logout: () => {
            Network.deleteCookies("https://mycomic.com");
        },

        registerWebsite: null,
    };

    // ==================== Explore ====================
    // 首页探索页：默认无标题分区、推荐给你、最近更新、最新上架 四个分区 (单行4条，整行保证8条或12条)
    explore = [
        {
            title: "MYCOMIC",
            type: "singlePageWithMultiPart",
            load: async () => {
                const resp = await fetchWithCFCheck(BASE_URL);
                if (resp.status !== 200) throw "HTTP " + resp.status;
                const doc = new HtmlDocument(resp.body);
                const parts = {};

                // 单行4条：保证每个分区为 8 条 (2行) 或 12 条 (3行)，避免单数落单
                function fitToRow(list, max = 12) {
                    if (!list || list.length === 0) return [];
                    if (list.length >= 12 && max >= 12) return list.slice(0, 12);
                    if (list.length >= 8) return list.slice(0, 8);
                    if (list.length >= 4) return list.slice(0, 4);
                    return list;
                }

                // 策略 1：检查 4 个分区网格容器 (每个分区通常为 8~16 条)
                const candidateGrids = doc.querySelectorAll("div.grid, div[class*='grid'], ul.grid");
                const sectionGrids = [];
                for (let i = 0; i < candidateGrids.length; i++) {
                    const list = parseComicList(candidateGrids[i], true);
                    if (list.length >= 8 && list.length <= 16) {
                        sectionGrids.push(list);
                    }
                }

                if (sectionGrids.length === 4) {
                    parts[""] = fitToRow(sectionGrids[0]);
                    parts["推荐给你"] = fitToRow(sectionGrids[1]);
                    parts["最近更新"] = fitToRow(sectionGrids[2]);
                    parts["最新上架"] = fitToRow(sectionGrids[3]);
                    doc.dispose();
                    return parts;
                }

                // 策略 2：通过标题关键字定位分区
                const allHeadings = doc.querySelectorAll("h1, h2, h3, h4, .text-xl, .text-lg, .font-bold");
                let recComics = [];
                let updateComics = [];
                let latestComics = [];

                function getComicsNearHeading(h) {
                    if (!h) return [];
                    let p = h.parent;
                    let list = p ? parseComicList(p, true) : [];
                    if (list.length >= 6) return list;
                    let next = p ? p.nextElementSibling : null;
                    list = next ? parseComicList(next, true) : [];
                    if (list.length >= 6) return list;
                    next = h.nextElementSibling;
                    list = next ? parseComicList(next, true) : [];
                    if (list.length >= 6) return list;
                    let gp = p ? p.parent : null;
                    list = gp ? parseComicList(gp, true) : [];
                    if (list.length >= 6) return list;
                    return [];
                }

                for (let i = 0; i < allHeadings.length; i++) {
                    const text = allHeadings[i].text.trim();
                    if (text.indexOf("推荐给你") !== -1 && recComics.length === 0) {
                        recComics = getComicsNearHeading(allHeadings[i]);
                    } else if (text.indexOf("最近更新") !== -1 && updateComics.length === 0) {
                        updateComics = getComicsNearHeading(allHeadings[i]);
                    } else if (text.indexOf("最新上架") !== -1 && latestComics.length === 0) {
                        latestComics = getComicsNearHeading(allHeadings[i]);
                    }
                }

                const allCards = parseAllComicCards(doc);

                if (recComics.length > 0 && updateComics.length > 0 && latestComics.length > 0) {
                    parts[""] = fitToRow(allCards);
                    parts["推荐给你"] = fitToRow(recComics);
                    parts["最近更新"] = fitToRow(updateComics);
                    parts["最新上架"] = fitToRow(latestComics);
                    doc.dispose();
                    return parts;
                }

                // 策略 3 (保底)：按 DOM 顺序拆分首页漫画到 4 个分区
                if (allCards.length >= 48) {
                    parts[""] = fitToRow(allCards.slice(0, 12));
                    parts["推荐给你"] = fitToRow(allCards.slice(12, 24));
                    parts["最近更新"] = fitToRow(allCards.slice(24, 36));
                    parts["最新上架"] = fitToRow(allCards.slice(36, 48));
                } else if (allCards.length >= 32) {
                    // 若总共约 32~36 条 (例如移动端 9 条 x 4)，每个分区保证 8 条整行
                    const size = Math.floor(allCards.length / 4);
                    parts[""] = fitToRow(allCards.slice(0, size));
                    parts["推荐给你"] = fitToRow(allCards.slice(size, size * 2));
                    parts["最近更新"] = fitToRow(allCards.slice(size * 2, size * 3));
                    parts["最新上架"] = fitToRow(allCards.slice(size * 3, size * 4));
                } else if (allCards.length >= 16) {
                    const size = Math.floor(allCards.length / 4);
                    parts[""] = fitToRow(allCards.slice(0, size));
                    parts["推荐给你"] = fitToRow(allCards.slice(size, size * 2));
                    parts["最近更新"] = fitToRow(allCards.slice(size * 2, size * 3));
                    parts["最新上架"] = fitToRow(allCards.slice(size * 3));
                } else {
                    parts[""] = fitToRow(allCards);
                }

                doc.dispose();
                return parts;
            },
        },
    ];

    // ==================== Category ====================

    category = {
        title: "MYCOMIC",
        parts: [
            {
                name: "作品类型",
                type: "fixed",
                categories: [
                    "魔幻", "魔法", "热血", "冒险", "悬疑", "侦探", "爱情",
                    "校园", "搞笑", "四格", "科幻", "神鬼", "舞蹈", "音乐",
                    "百合", "后宫", "机战", "格斗", "恐怖", "萌系", "武侠",
                    "社会", "历史", "耽美", "励志", "职场", "生活", "治愈",
                    "伪娘", "黑道", "战争", "竞技", "体育", "美食", "腐女",
                    "宅男", "推理", "杂志",
                ],
                itemType: "category",
                categoryParams: [
                    "tag:mohuan", "tag:mofa", "tag:rexue", "tag:maoxian",
                    "tag:xuanyi", "tag:zhentan", "tag:aiqing", "tag:xiaoyuan",
                    "tag:gaoxiao", "tag:sige", "tag:kehuan", "tag:shengui",
                    "tag:wudao", "tag:yinyue", "tag:baihe", "tag:hougong",
                    "tag:jizhan", "tag:gedou", "tag:kongbu", "tag:mengxi",
                    "tag:wuxia", "tag:shehui", "tag:lishi", "tag:danmei",
                    "tag:lizhi", "tag:zhichang", "tag:shenghuo", "tag:zhiyu",
                    "tag:weiniang", "tag:heidao", "tag:zhanzheng", "tag:jingji",
                    "tag:tiyu", "tag:meishi", "tag:funv", "tag:zhainan",
                    "tag:tuili", "tag:zazhi",
                ],
            },
            {
                name: "作品地区",
                type: "fixed",
                categories: ["日本", "港台", "欧美", "内地", "韩国", "其他"],
                itemType: "category",
                categoryParams: [
                    "country:japan", "country:hongkong", "country:europe",
                    "country:china", "country:korea", "country:other",
                ],
            },
            {
                name: "适合受众",
                type: "fixed",
                categories: ["少女", "少年", "青年", "儿童", "通用"],
                itemType: "category",
                categoryParams: [
                    "audience:shaonv", "audience:shaonian", "audience:qingnian",
                    "audience:ertong", "audience:tongyong",
                ],
            },
            {
                name: "出品年份",
                type: "fixed",
                categories: [
                    "2026", "2025", "2024", "2023", "2022", "2021",
                    "2020", "2019", "2018", "2017", "2016", "2015",
                    "2014", "2013", "2012", "2011", "2010",
                    "00年代", "90年代", "80年代", "70年代或更早",
                ],
                itemType: "category",
                categoryParams: [
                    "year:2026", "year:2025", "year:2024", "year:2023",
                    "year:2022", "year:2021", "year:2020", "year:2019",
                    "year:2018", "year:2017", "year:2016", "year:2015",
                    "year:2014", "year:2013", "year:2012", "year:2011",
                    "year:2010", "year:200x", "year:199x", "year:198x",
                    "year:197x",
                ],
            },
            {
                name: "目前进度",
                type: "fixed",
                categories: ["连载中", "已完结"],
                itemType: "category",
                categoryParams: ["end:0", "end:1"],
            },
        ],
        enableRankingPage: true,
    };

    // ==================== Category Comics ====================

    categoryComics = {
        load: async (category, param, options, page) => {
            if (!page) page = 1;

            // Parse filter type and value from param (format: "type:value")
            let filterType = null;
            let filterValue = null;
            let sort = "-id";

            if (param) {
                const parts = param.split(":");
                if (parts.length >= 2) {
                    filterType = parts[0];
                    filterValue = parts.slice(1).join(":");
                }
            }

            // Get sort option
            if (options && options.length > 0 && options[0]) {
                sort = options[0];
            }

            const url = buildComicsUrl(page, sort, null, filterType, filterValue);
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const doc = new HtmlDocument(resp.body);
            const comics = parseComicList(doc);
            const maxPage = parseMaxPage(resp.body);

            return { comics, maxPage };
        },

        optionList: [
            {
                options: [
                    "-id-最新上架",
                    "-update-最近更新",
                    "-views-最高人气",
                ],
            },
        ],

        ranking: {
            options: [
                "-views-历史排行",
                "-week-週排行",
                "-month-月排行",
            ],
            load: async (option, page) => {
                if (!page) page = 1;
                const sort = option || "-views";
                const url =
                    BASE_URL +
                    "/rank?sort=" +
                    sort +
                    (page > 1 ? "&page=" + page : "");
                const resp = await fetchWithCFCheck(url);
                if (resp.status !== 200) throw "HTTP " + resp.status;

                const doc = new HtmlDocument(resp.body);
                const comics = parseComicList(doc);
                const maxPage = parseMaxPage(resp.body);

                return { comics, maxPage };
            },
        },
    };

    // ==================== Search ====================

    search = {
        load: async (keyword, options, page) => {
            if (!page) page = 1;
            const kw = (keyword || "").trim();
            if (!kw) return { comics: [], maxPage: 1 };

            let sort = null;
            if (options && options.length > 0 && options[0]) {
                sort = options[0];
            }

            const url = buildComicsUrl(page, sort, kw);
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const doc = new HtmlDocument(resp.body);
            const comics = parseComicList(doc);
            const maxPage = parseMaxPage(resp.body);

            return { comics, maxPage };
        },

        optionList: [
            {
                type: "select",
                options: [
                    "-id-最新上架",
                    "-update-最近更新",
                    "-views-最高人气",
                ],
                label: "排序",
                default: null,
            },
        ],

        enableTagsSuggestions: false,
    };

    // ==================== Comic Detail ====================

    comic = {
        loadInfo: async (id) => {
            const url = BASE_URL + "/comics/" + id;
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const html = resp.body;
            const doc = new HtmlDocument(html);

            // Parse meta tags
            let title = getMetaContent(html, "og:title") || id;
            title = title.replace(/\s*-\s*MYCOMIC.*$/, "").trim();

            const description = getMetaContent(html, "description") || "";
            const author = getMetaContent(html, "author") || "";
            // 1. Try meta tags: og:image, twitter:image
            let cover = getMetaContent(html, "og:image") ||
                        getMetaContent(html, "twitter:image") || "";

            // 2. Try DOM img on the detail page (essential for "通过URL获取")
            if (!cover || cover.indexOf("biccam.com") === -1) {
                const imgs = doc.querySelectorAll("img");
                for (let i = 0; i < imgs.length; i++) {
                    const c = extractCoverFromImg(imgs[i]);
                    if (c && c.indexOf("biccam.com/comics/") !== -1) {
                        cover = c;
                        break;
                    }
                }
                if (!cover) {
                    for (let i = 0; i < imgs.length; i++) {
                        const c = extractCoverFromImg(imgs[i]);
                        if (c && c.indexOf("/comics/") !== -1) {
                            cover = c;
                            break;
                        }
                    }
                }
                if (!cover) {
                    const coverContainer = doc.querySelector("div[class*='cover'], div[class*='poster'], div[class*='thumb'], div[class*='image']");
                    if (coverContainer) {
                        const cImg = coverContainer.querySelector("img");
                        if (cImg) {
                            cover = extractCoverFromImg(cImg);
                        }
                    }
                }
            }

            if (cover) {
                cover = cover.replace(/&amp;/g, "&").trim();
                if (cover.startsWith("//")) {
                    cover = "https:" + cover;
                } else if (cover.startsWith("/") && (cover.indexOf("biccam.com") !== -1 || cover.indexOf("/comics/") !== -1)) {
                    cover = CDN_URL + cover;
                } else if (cover.startsWith("/")) {
                    cover = "https://mycomic.com" + cover;
                }
            }
            const keywords = getMetaContent(html, "keywords") || "";

            // Parse tags from filter links on the page
            const tags = new Map();
            const tagLinks = doc.querySelectorAll(
                "a[href*='filter%5Btag%5D']"
            );
            const tagNames = [];
            tagLinks.forEach((a) => {
                const text = a.text.trim();
                if (text) tagNames.push(text);
            });
            if (tagNames.length) tags.set("类型", tagNames);

            // Parse additional info from keywords
            const keywordList = keywords
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            if (author) tags.set("作者", [author]);

            // Try to extract country and audience from keywords
            const countryMap = {
                日本: "日本",
                内地: "内地",
                韩国: "韩国",
                欧美: "欧美",
                港台: "港台",
                其他: "其他",
            };
            const audienceMap = {
                少年: "少年",
                少女: "少女",
                青年: "青年",
                儿童: "儿童",
                通用: "通用",
            };
            const countries = [];
            const audiences = [];
            keywordList.forEach((kw) => {
                if (countryMap[kw]) countries.push(kw);
                if (audienceMap[kw]) audiences.push(kw);
            });
            if (countries.length) tags.set("地区", countries);
            if (audiences.length) tags.set("受众", audiences);

            // Parse chapter list from Alpine.js x-data
            // The x-data attribute contains: chapters: [{"id":96338,"title":"第16回"}, ...]
            const chapters = new Map();
            const chapterMatch = /chapters:\s*(\[[\s\S]*?\])/.exec(html);
            if (chapterMatch) {
                try {
                    const chapterList = JSON.parse(chapterMatch[1]);
                    chapterList.forEach((ch) => {
                        chapters.set(String(ch.id), ch.title);
                    });
                } catch (e) {
                    // Fallback: try to find chapter links in the page
                    const chapterLinks = doc.querySelectorAll(
                        "a[href*='/cn/chapters/']"
                    );
                    chapterLinks.forEach((a) => {
                        const href = a.attributes["href"] || "";
                        const m = /\/cn\/chapters\/(\d+)/.exec(href);
                        if (m) {
                            const chTitle = a.text.trim();
                            if (chTitle && !chapters.has(m[1])) {
                                chapters.set(m[1], chTitle);
                            }
                        }
                    });
                }
            }

            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                thumbnails: [cover],
                url: url,
                uploader: author || undefined,
            });
        },

        loadEp: async (comicId, epId) => {
            if (!epId) {
                throw "No episode id";
            }
            const url = BASE_URL + "/chapters/" + epId;
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const doc = new HtmlDocument(resp.body);
            // Chapter images have class "page" and src or data-src from biccam.com/chapters/
            const imgs = doc.querySelectorAll("img.page");
            const images = [];

            if (imgs.length > 0) {
                imgs.forEach((img) => {
                    let src =
                        img.attributes["data-src"] ||
                        img.attributes["src"] ||
                        "";
                    if (src && src.indexOf("biccam.com/chapters/") !== -1) {
                        images.push(src);
                    }
                });
            }

            // Fallback: find all imgs with src containing biccam.com/chapters/
            if (images.length === 0) {
                const allImgs = doc.querySelectorAll("img");
                allImgs.forEach((img) => {
                    let src =
                        img.attributes["data-src"] ||
                        img.attributes["src"] ||
                        "";
                    if (src && src.indexOf("biccam.com/chapters/") !== -1) {
                        images.push(src);
                    }
                });
            }

            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            if (!url) return null;
            let finalUrl = url.replace(/&amp;/g, "&").trim();
            if (finalUrl.startsWith("//")) {
                finalUrl = "https:" + finalUrl;
            } else if (finalUrl.startsWith("/") && (finalUrl.indexOf("biccam.com") !== -1 || finalUrl.indexOf("/chapters/") !== -1 || finalUrl.indexOf("/comics/") !== -1)) {
                finalUrl = CDN_URL + finalUrl;
            } else if (finalUrl.startsWith("/")) {
                finalUrl = "https://mycomic.com" + finalUrl;
            }
            return {
                url: finalUrl,
                headers: {
                    "Referer": REFERER,
                    "User-Agent": UA,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "no-cors",
                    "Sec-Fetch-Site": "cross-site",
                },
            };
        },

        onThumbnailLoad: (url) => {
            if (!url) return null;
            let finalUrl = url.replace(/&amp;/g, "&").trim();
            if (finalUrl.startsWith("//")) {
                finalUrl = "https:" + finalUrl;
            } else if (finalUrl.startsWith("/") && (finalUrl.indexOf("biccam.com") !== -1 || finalUrl.indexOf("/comics/") !== -1 || finalUrl.indexOf("/chapters/") !== -1)) {
                finalUrl = CDN_URL + finalUrl;
            } else if (finalUrl.startsWith("/")) {
                finalUrl = "https://mycomic.com" + finalUrl;
            }
            return {
                url: finalUrl,
                headers: {
                    "Referer": REFERER,
                    "User-Agent": UA,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "no-cors",
                    "Sec-Fetch-Site": "cross-site",
                },
            };
        },

        onClickTag: (namespace, tag) => {
            return {
                page: "search",
                attributes: {
                    keyword: tag,
                },
            };
        },

        link: {
            domains: ["mycomic.com", "m.mycomic.com", "www.mycomic.com"],
            linkToId: (url) => {
                if (!url) return null;
                const m = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?mycomic\.com\/(?:cn\/)?comics\/(\d+)/i.exec(
                    url
                );
                if (!m) return null;
                return m[1];
            },
        },
    };
}
