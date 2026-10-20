/** @type {import('./_venera_.js')} */

// ==========================================
// 辅助函数
// ==========================================

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
        return true;
    }
    return false;
}

/**
 * 网格单行 4 项对齐裁剪函数（避免首页多出非4整倍数项目导致末行悬空空白）
 */
function fitToRow(list, max = 24) {
    if (!list || list.length === 0) return [];
    const count = Math.min(list.length, max);
    const rows = Math.floor(count / 4);
    return list.slice(0, Math.max(rows * 4, 4));
}

/**
 * 补全图片相对路径为完整绝对 URL
 */
function normalizeImageUrl(url) {
    if (!url) return "";
    let u = url.trim();
    if (u.startsWith("//")) return "https:" + u;
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return "https://" + u.replace(/^\/+/, "");
}

// ==========================================
// 漫画源实现
// ==========================================

class Wnacg extends ComicSource {
    name = "紳士漫畫"
    key = "wnacg"
    version = "1.0.6"
    minAppVersion = "1.0.0"
    url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@wnacg-v1.0.6/wnacg.js"

    static domains = ["www.wnacg.com", "wnacg.com"];

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    };

    get baseUrl() {
        let selection = this.loadSetting('domainSelection')
        if (selection === undefined || selection === null) selection = 0
        selection = parseInt(selection)

        if (selection === 0) {
            // 选择自定义域名
            let domain0 = this.loadSetting('domain0')
            if (!domain0 || domain0.trim() === '') {
                throw 'Custom domain is not set'
            }
            let cleaned = domain0.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
            return `https://${cleaned}`
        } else {
            // 选择获取的域名 (Domain 1-3)
            let index = selection - 1
            if (index >= Wnacg.domains.length) {
                throw 'Selected domain is unavailable'
            }
            let cleaned = Wnacg.domains[index].replace(/^https?:\/\//, '').replace(/\/+$/, '')
            return `https://${cleaned}`
        }
    }

    overwriteDomains(domains) {
        if (domains && domains.length !== 0) Wnacg.domains = domains
    }

    async request(url, customHeaders = this.headers) {
        let res = await Network.get(url, customHeaders)
        if (isCloudflareChallenge(res.status, res.body)) {
            throw "Cloudflare 验证拦截：请在漫画源设置中切换备用域名，或通过网页端完成人机验证。"
        }
        if (res.status !== 200) {
            throw `Invalid Status Code ${res.status}`
        }
        return res
    }

    // 账号相关
    account = {
        /**
         * login, return any value to indicate success
         * @param account {string}
         * @param pwd {string}
         * @returns {Promise<any>}
         */
        login: async (account, pwd) => {
            let res = await Network.post(
                `${this.baseUrl}/users-check_login.html`,
                {
                    ...this.headers,
                    'content-type': 'application/x-www-form-urlencoded',
                    'Referer': `${this.baseUrl}/users-login.html`,
                },
                `login_name=${encodeURIComponent(account.trim())}&login_pass=${encodeURIComponent(pwd.trim())}`
            )
            if (res.status !== 200) {
                throw 'Login failed'
            }
            let json = JSON.parse(res.body)
            if (json && json['html'] && json['html'].includes('登錄成功')) {
                return 'ok'
            }
            throw 'Login failed'
        },

        /**
         * logout function, clear account related data
         */
        logout: () => {
            Network.deleteCookies(this.baseUrl)
        },

        registerWebsite: null
    }

    async init() {
        if (this.loadSetting('refreshDomainsOnStart')) await this.refreshDomains(false)
    }

    /**
     * 刷新域名列表
     * @param showConfirmDialog {boolean}
     */
    async refreshDomains(showConfirmDialog) {
        let url = "https://wn01.link/"
        let title = ""
        let message = ""
        let domains = []

        try {
            let res = await Network.get(url, this.headers)
            if (res.status === 200) {
                let html = res.body
                let document = new HtmlDocument(html)
                try {
                    let links = document.querySelectorAll("a[href]")
                    let seenDomains = new Set()

                    for (let link of links) {
                        let href = link.attributes["href"]
                        if (!href) continue

                        let match = href.match(/^https?:\/\/([^\/]+)/)
                        if (match) {
                            let domain = match[1]
                            if (domain &&
                                domain.includes(".") &&
                                !domain.includes("wn01.link") &&
                                !domain.includes("google.cn") &&
                                !domain.includes("cdn-cgi") &&
                                !seenDomains.has(domain)) {
                                domains.push(domain)
                                seenDomains.add(domain)
                            }
                        }
                    }
                } finally {
                    document.dispose()
                }

                if (domains.length > 0) {
                    title = "Update Success"
                    message = "Fetched: \n\n"
                }
            }
        } catch (e) {
            // 获取失败，保留现有域名
        }

        if (domains.length === 0) {
            title = "Update Failed"
            message = "Using Current: \n\n"
            domains = Wnacg.domains
        }

        for (let i = 0; i < domains.length; i++) {
            message = message + `URL ${i + 1}: ${domains[i]}\n`
        }
        message = message + `\n Total: ${domains.length} URLs\n\n Re-enter page to refresh`

        if (showConfirmDialog) {
            UI.showDialog(
                title,
                message,
                [
                    {
                        text: "Cancel",
                        callback: () => { }
                    },
                    {
                        text: "Apply",
                        callback: () => this.overwriteDomains(domains)
                    }
                ]
            )
        } else {
            this.overwriteDomains(domains)
        }
    }

    parseComic(c) {
        let aEl = c.querySelector("div.pic_box > a")
        let link = aEl?.attributes?.["href"] || ""
        let matchId = link.match(/-aid-(\d+)/)
        let id = matchId ? matchId[1] : ""
        if (!id) return null

        let imgEl = c.querySelector("div.pic_box > a > img")
        let image = normalizeImageUrl(imgEl?.attributes?.["src"] || imgEl?.attributes?.["data-src"])

        let titleEl = c.querySelector("div.info > div.title > a")
        let name = (titleEl?.text || "").trim()

        let infoEl = c.querySelector("div.info > div.info_col")
        let info = (infoEl?.text || "").replace(/\s+/g, ' ').trim()

        return new Comic({
            id: id,
            title: name,
            cover: image,
            description: info,
        })
    }

    // explore page list
    explore = [
        {
            title: "紳士漫畫",
            type: "multiPartPage",
            load: async (page) => {
                let res = await this.request(this.baseUrl)
                let document = new HtmlDocument(res.body)
                try {
                    let titleBlocks = document.querySelectorAll("div.title_sort")
                    let comicBlocks = document.querySelectorAll("div.bodywrap")
                    if (titleBlocks.length !== comicBlocks.length) {
                        throw "Invalid Page"
                    }
                    let result = []
                    for (let i = 0; i < titleBlocks.length; i++) {
                        let title = titleBlocks[i].querySelector("div.title_h2")?.text?.replaceAll(/\s+/g, '') || "推薦"
                        let link = titleBlocks[i].querySelector("div.r > a")?.attributes?.["href"] || ""
                        let comics = []
                        let comicBlock = comicBlocks[i]
                        let comicElements = comicBlock.querySelectorAll("div.gallary_wrap > ul.cc > li")
                        for (let comicElement of comicElements) {
                            let comic = this.parseComic(comicElement)
                            if (comic) comics.push(comic)
                        }
                        result.push({
                            title: title,
                            comics: fitToRow(comics, 24),
                            viewMore: link ? `category:${title}@${link}` : null
                        })
                    }
                    return result
                } finally {
                    document.dispose()
                }
            }
        }
    ]

    // categories
    category = {
        title: "紳士漫畫",
        parts: [
            {
                name: "最新",
                type: "fixed",
                categories: ["最新"],
                itemType: "category",
                categoryParams: ["/albums.html"],
                groupParam: null,
            },
            {
                name: "同人誌",
                type: "fixed",
                categories: ["同人誌", "漢化", "日語", "English", "CG畫集", "3D漫畫", "寫真Cosplay"],
                itemType: "category",
                categoryParams: [
                    "/albums-index-cate-5.html",
                    "/albums-index-cate-1.html",
                    "/albums-index-cate-12.html",
                    "/albums-index-cate-16.html",
                    "/albums-index-cate-2.html",
                    "/albums-index-cate-22.html",
                    "/albums-index-cate-3.html",
                ],
                groupParam: null,
            },
            {
                name: "單行本",
                type: "fixed",
                categories: ["單行本", "漢化", "日語", "English"],
                itemType: "category",
                categoryParams: [
                    "/albums-index-cate-6.html",
                    "/albums-index-cate-9.html",
                    "/albums-index-cate-13.html",
                    "/albums-index-cate-17.html",
                ],
                groupParam: null,
            },
            {
                name: "雜誌短篇",
                type: "fixed",
                categories: ["雜誌短篇", "漢化", "日語", "English"],
                itemType: "category",
                categoryParams: [
                    "/albums-index-cate-7.html",
                    "/albums-index-cate-10.html",
                    "/albums-index-cate-14.html",
                    "/albums-index-cate-18.html",
                ],
                groupParam: null,
            },
            {
                name: "韓漫",
                type: "fixed",
                categories: ["韓漫", "漢化", "生肉"],
                itemType: "category",
                categoryParams: [
                    "/albums-index-cate-19.html",
                    "/albums-index-cate-20.html",
                    "/albums-index-cate-21.html",
                ],
                groupParam: null,
            },
        ],
        enableRankingPage: true,
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
            let url = this.baseUrl + param
            if (page !== 0) {
                if (!url.includes("-")) {
                    url = url.replaceAll(".html", "-.html")
                }
                url = url.replaceAll("index", "")
                let lr = url.split("albums-")
                lr[1] = `index-page-${page}${lr[1]}`
                url = `${lr[0]}albums-${lr[1]}`
            }

            let res = await this.request(url)
            let document = new HtmlDocument(res.body)
            try {
                let comicElements = document.querySelectorAll("div.grid div.gallary_wrap > ul.cc > li")
                let comics = []
                for (let comicElement of comicElements) {
                    let comic = this.parseComic(comicElement)
                    if (comic) comics.push(comic)
                }
                let pagesLink = document.querySelectorAll("div.f_left.paginator > a")
                let pages = 1
                if (pagesLink && pagesLink.length > 0) {
                    let n = parseInt(pagesLink[pagesLink.length - 1].text.trim())
                    pages = !isNaN(n) && n > 0 ? n : 1
                }
                return {
                    comics: comics,
                    maxPage: pages,
                }
            } finally {
                document.dispose()
            }
        },
        ranking: {
            options: [
                "day-Day",
                "week-Week",
                "month-Month",
            ],
            load: async (option, page) => {
                let url = `${this.baseUrl}/albums-favorite_ranking-type-${option}.html`
                if (page !== 0) {
                    url = `${this.baseUrl}/albums-favorite_ranking-page-${page}-type-${option}.html`
                }

                let res = await this.request(url)
                let document = new HtmlDocument(res.body)
                try {
                    let comicElements = document.querySelectorAll("div.grid div.gallary_wrap > ul.cc > li")
                    let comics = []
                    for (let comicElement of comicElements) {
                        let comic = this.parseComic(comicElement)
                        if (comic) comics.push(comic)
                    }

                    let pagesLink = document.querySelectorAll("div.f_left.paginator > a")
                    let pages = 1
                    if (pagesLink && pagesLink.length > 0) {
                        let n = parseInt(pagesLink[pagesLink.length - 1].text.trim())
                        pages = !isNaN(n) && n > 0 ? n : 1
                    }

                    return {
                        comics: comics,
                        maxPage: pages,
                    }
                } finally {
                    document.dispose()
                }
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
            if (!keyword || !keyword.trim()) return { comics: [], maxPage: 1 }
            let trimmed = keyword.trim()
            let url = `${this.baseUrl}/search/?q=${encodeURIComponent(trimmed)}&f=_all&s=create_time_DESC&syn=yes`
            if (page !== 0) {
                url += `&p=${page}`
            }
            let res = await this.request(url)

            if (res.body.includes("<title>登录") || res.body.includes("請先登錄") || res.body.includes("请先登录")) {
                throw "该源搜索功能需要登录账号：请在漫画源设置中点击「登录」后重试。"
            }
            if (res.body.includes("暫無漫畫") || res.body.includes("沒有找到") || res.body.includes("没有找到") || res.body.includes("没有搜索结果")) {
                return { comics: [], maxPage: 1 }
            }

            let document = new HtmlDocument(res.body)
            try {
                let comicElements = document.querySelectorAll("div.grid div.gallary_wrap > ul.cc > li")
                let comics = []
                for (let comicElement of comicElements) {
                    let comic = this.parseComic(comicElement)
                    if (comic) comics.push(comic)
                }
                let resultElements = document.querySelectorAll("p.result > b")
                let pages = 1
                if (resultElements && resultElements.length > 0) {
                    let totalStr = resultElements[0].text.replaceAll(',', '').trim()
                    let total = parseInt(totalStr)
                    const comicsPerPage = 24
                    if (!isNaN(total) && total > 0) {
                        pages = Math.ceil(total / comicsPerPage)
                    }
                } else {
                    let pagesLink = document.querySelectorAll("div.f_left.paginator > a")
                    if (pagesLink && pagesLink.length > 0) {
                        let n = parseInt(pagesLink[pagesLink.length - 1].text.trim())
                        pages = !isNaN(n) && n > 0 ? n : 1
                    }
                }
                return {
                    comics: comics,
                    maxPage: pages,
                }
            } finally {
                document.dispose()
            }
        },
    }

    // favorite related
    favorites = {
        multiFolder: true,
        isOldToNewSort: true,
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
            if (!isAdding) {
                let res = await Network.get(`${this.baseUrl}/users-fav_del-id-${favoriteId}.html?ajax=true&_t=${Math.random()}`, this.headers)
                if (res.status !== 200) {
                    throw 'Delete failed'
                }
            } else {
                let res = await Network.post(`${this.baseUrl}/users-save_fav-id-${comicId}.html`, {
                    ...this.headers,
                    'content-type': 'application/x-www-form-urlencoded',
                    'Referer': `${this.baseUrl}/photos-index-page-1-aid-${comicId}.html`,
                }, `favc_id=${folderId}`)
                if (res.status !== 200) {
                    throw 'Add failed'
                }
            }
            return 'ok'
        },
        /**
         * load favorite folders.
         * throw `Login expired` to indicate login expired, App will automatically re-login retry.
         * if comicId is not null, return favorite folders which contains the comic.
         * @param comicId {string?}
         * @returns {Promise<{folders: {[p: string]: string}, favorited: string[]}>} - `folders` is a map of folder id to folder name, `favorited` is a list of folder id which contains the comic
         */
        loadFolders: async (comicId) => {
            let res = await this.request(`${this.baseUrl}/users-addfav-id-210814.html`)
            let document = new HtmlDocument(res.body)
            try {
                let data = {}
                document.querySelectorAll("option").forEach((option => {
                    if (option.attributes["value"] === "") return
                    data[option.attributes["value"]] = option.text
                }))
                return {
                    folders: data,
                    favorited: []
                }
            } finally {
                document.dispose()
            }
        },
        /**
         * add a folder
         * @param name {string}
         * @returns {Promise<any>} - return any value to indicate success
         */
        addFolder: async (name) => {
            let res = await Network.post(`${this.baseUrl}/users-favc_save-id.html`, {
                ...this.headers,
                'content-type': 'application/x-www-form-urlencoded',
                'Referer': `${this.baseUrl}/users-users_fav.html`,
            }, `favc_name=${encodeURIComponent(name)}`)
            if (res.status !== 200) {
                throw 'Add failed'
            }
            return 'ok'
        },
        /**
         * delete a folder
         * @param folderId {string}
         * @returns {Promise<void>} - return any value to indicate success
         */
        deleteFolder: async (folderId) => {
            let res = await Network.get(`${this.baseUrl}/users-favclass_del-id-${folderId}.html?ajax=true&_t=${Math.random()}`, this.headers)
            if (res.status !== 200) {
                throw 'Delete failed'
            }
            return 'ok'
        },
        /**
         * load comics in a folder
         * throw `Login expired` to indicate login expired, App will automatically re-login retry.
         * @param page {number}
         * @param folder {string?} - folder id, null for non-multi-folder
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        loadComics: async (page, folder) => {
            let url = `${this.baseUrl}/users-users_fav-page-${page}-c-${folder}.html.html`
            let res = await this.request(url)
            let document = new HtmlDocument(res.body)
            try {
                let comicBlocks = document.querySelectorAll("div.asTB")
                let comics = []
                for (let comic of comicBlocks) {
                    try {
                        let imgEl = comic.querySelector("div.asTBcell.thumb > div > img")
                        let cover = normalizeImageUrl(imgEl?.attributes?.["src"])
                        let timeEl = comic.querySelector("div.box_cel.u_listcon > p.l_catg > span")
                        let time = (timeEl?.text || "").replaceAll("創建時間：", "").trim()
                        let nameEl = comic.querySelector("div.box_cel.u_listcon > p.l_title > a")
                        let name = (nameEl?.text || "").trim()
                        let link = nameEl?.attributes?.["href"] || ""
                        let matchId = link.match(/-aid-(\d+)/)
                        let id = matchId ? matchId[1] : ""
                        let infoEl = comic.querySelector("div.box_cel.u_listcon > p.l_detla")
                        let info = infoEl?.text || ""
                        let matchPages = info.match(/頁數：(\d+)/)
                        let pages = matchPages ? Number(matchPages[1]) : 0
                        let delLink = comic.querySelector("div.box_cel.u_listcon > p.alopt > a")
                        let delUrl = delLink?.attributes?.["onclick"] || ""
                        let matchFav = delUrl.match(/del-id-(\d+)/)
                        let favoriteId = matchFav ? matchFav[1] : null
                        if (id) {
                            comics.push(new Comic({
                                id: id,
                                title: name,
                                subtitle: time,
                                cover: cover,
                                pages: pages,
                                favoriteId: favoriteId,
                            }))
                        }
                    } catch (_) {}
                }
                let pages = 1
                let pagesLink = document.querySelectorAll("div.f_left.paginator > a")
                if (pagesLink && pagesLink.length > 0) {
                    let n = parseInt(pagesLink[pagesLink.length - 1].text.trim())
                    pages = !isNaN(n) && n > 0 ? n : 1
                }
                return {
                    comics: comics,
                    maxPage: pages,
                }
            } finally {
                document.dispose()
            }
        }
    }

    /// single comic related
    comic = {
        // 正文阅读器图片加载标头 (防 403 必备)
        onImageLoad: (url, comicId, epId) => ({
            url,
            headers: {
                ...this.headers,
                "Referer": `${this.baseUrl}/`,
            }
        }),

        // 缩略图加载标头
        onThumbnailLoad: (url) => ({
            url,
            headers: {
                ...this.headers,
                "Referer": `${this.baseUrl}/`,
            }
        }),

        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            let res = await this.request(`${this.baseUrl}/photos-index-page-1-aid-${id}.html`)
            let document = new HtmlDocument(res.body)
            try {
                let titleEl = document.querySelector("div.userwrap > h2")
                let title = titleEl ? titleEl.text.trim() : ""
                let coverEl = document.querySelector("div.userwrap > div.asTB > div.asTBcell.uwthumb > img")
                let cover = normalizeImageUrl(coverEl?.attributes?.["src"])

                let labels = document.querySelectorAll("div.asTBcell.uwconn > label")
                let category = ""
                let pages = ""
                if (labels.length > 0) {
                    category = (labels[0].text || "").split("：")[1] || ""
                }
                if (labels.length > 1) {
                    pages = (labels[1].text || "").split("：")[1] || ""
                }
                let tagsDom = document.querySelectorAll("a.tagshow")
                let tags = new Map()
                if (pages) tags.set("頁數", [pages.trim()])
                if (category) tags.set("分類", [category.trim()])
                if (tagsDom.length > 0) {
                    tags.set("標籤", tagsDom.map((e) => e.text.trim()))
                }
                let descEl = document.querySelector("div.asTBcell.uwconn > p")
                let description = descEl ? descEl.text.trim() : ""
                let uploaderEl = document.querySelector("div.asTBcell.uwuinfo > a > p")
                let uploader = uploaderEl ? uploaderEl.text.trim() : ""

                let parsedPages = parseInt(pages.trim())
                return new ComicDetails({
                    id: id,
                    title: title,
                    cover: cover,
                    pages: !isNaN(parsedPages) ? parsedPages : undefined,
                    tags: tags,
                    description: description,
                    uploader: uploader,
                    chapters: {
                        "1": title || "正文"
                    }
                })
            } finally {
                document.dispose()
            }
        },

        /**
         * [Optional] load thumbnails of a comic
         * @param id {string}
         * @param next {string | null | undefined} - next page token, null for first page
         * @returns {Promise<{thumbnails: string[], next: string?}>} - `next` is next page token, null for no more
         */
        loadThumbnails: async (id, next) => {
            next = next || '1'
            let res = await this.request(`${this.baseUrl}/photos-index-page-${next}-aid-${id}.html`)
            let document = new HtmlDocument(res.body)
            try {
                let thumbnails = document.querySelectorAll("div.pic_box.tb > a > img").map((e) => {
                    return normalizeImageUrl(e.attributes["src"])
                })
                let nextPage = (Number(next) + 1).toString()
                let paginator = document.querySelector("div.f_left.paginator")
                if (paginator && paginator.children) {
                    let pagesLink = paginator.children
                    if (pagesLink.length > 0 && pagesLink[pagesLink.length - 1].classNames && pagesLink[pagesLink.length - 1].classNames.includes("thispage")) {
                        nextPage = null
                    }
                } else {
                    nextPage = null
                }
                return {
                    thumbnails: thumbnails,
                    next: nextPage
                }
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
            let res = await this.request(`${this.baseUrl}/photos-gallery-aid-${comicId}.html`)
            let body = res.body.replaceAll('\\/', '/').replaceAll('\\"', '"')

            let regex = /(?:https?:)?\/\/[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp|gif|bmp)/gi
            let matches = Array.from(body.matchAll(regex))

            if (matches.length === 0) {
                regex = RegExp(String.raw`//[^"'\s<>\\]+/[^"'\s<>\\]+\.[^"'\s<>\\]+`, 'g')
                matches = Array.from(body.matchAll(regex))
            }

            let images = matches.map((m) => {
                let imgUrl = m[0]
                if (imgUrl.endsWith('\\') || imgUrl.endsWith('"') || imgUrl.endsWith("'")) {
                    imgUrl = imgUrl.slice(0, -1)
                }
                imgUrl = imgUrl.replace(/\\/g, '')
                return normalizeImageUrl(imgUrl)
            })

            return {
                images: Array.from(new Set(images))
            }
        },

        /**
         * [Optional] Handle tag click event
         * @param namespace {string}
         * @param tag {string}
         * @returns {{action: string, keyword: string, param: string?}}
         */
        onClickTag: (namespace, tag) => {
            return {
                action: 'search',
                keyword: tag,
            }
        },
    }

    get settings() {
        let domainOptions = [{ value: '0', text: 'Custom Domain' }]
        for (let i = 0; i < Wnacg.domains.length; i++) {
            domainOptions.push({
                value: String(i + 1),
                text: Wnacg.domains[i]
            })
        }

        return {
            refreshDomains: {
                title: "Refresh Domain List",
                type: "callback",
                buttonText: "Refresh",
                callback: () => this.refreshDomains(true)
            },
            refreshDomainsOnStart: {
                title: "Refresh Domain List on Startup",
                type: "switch",
                default: true,
            },
            domainSelection: {
                title: "Domain Selection",
                type: "select",
                options: domainOptions,
                default: "0",
            },
            domain0: {
                title: "Custom Domain",
                type: "input",
                validator: String.raw`^(?!:\/\/)(?=.{1,253})([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`,
                default: 'wnacg.com',
            },
        }
    }

    translation = {
        'zh_CN': {
            'Refresh Domain List': '刷新域名列表',
            'Refresh': '刷新',
            'Refresh Domain List on Startup': '启动时刷新域名列表',
            'Domain Selection': '域名选择',
            'Custom Domain': '自定义域名',
            'Custom domain is not set': '未设置自定义域名',
            'Selected domain is unavailable': '所选域名不可用，请先刷新域名列表',
            'Day': '日',
            'Week': '周',
            'Month': '月',
        },
        'zh_TW': {
            'Refresh Domain List': '刷新域名列表',
            'Refresh': '刷新',
            'Refresh Domain List on Startup': '啟動時刷新域名列表',
            'Domain Selection': '域名選擇',
            'Custom Domain': '自定義域名',
            'Custom domain is not set': '未設置自定義域名',
            'Selected domain is unavailable': '所選域名不可用，請先刷新域名列表',
            'Day': '日',
            'Week': '周',
            'Month': '月',
        },
    }
}
