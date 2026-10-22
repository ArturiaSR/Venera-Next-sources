/**
 * 适配 4 列网格裁剪函数（避免最后一行悬空空白）
 */
function fitToRow(list, max = 0) {
  let len = list.length;
  if (max > 0 && len > max) {
    len = max;
  }
  const remainder = len % 4;
  return list.slice(0, len - remainder);
}

/** @type {import('./_venera_.js')} */
class Mkzhan extends ComicSource {
  name = "漫客栈";
  key = "mkzhan";
  version = "1.0.2";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@mkzhan-v1.0.2/mkzhan.js";

  settings = {
    domains: {
      title: "选择网页域名",
      type: "select",
      options: [
        { value: "https://www.mkzhan.com", text: "https://www.mkzhan.com (官网)" }
      ],
      default: "https://www.mkzhan.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://www.mkzhan.com";
  }

  get apiBase() {
    return "https://comic.mkzcdn.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9"
    };
  }

  fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.baseUrl.replace(/\/$/, "") + "/" + u.replace(/^\//, "");
  }

  parseComicCard(item) {
    let link = item.querySelector("a.cover, .comic__title a, a");
    if (!link) return null;
    let href = link.attributes.href || "";
    let id = href.replace(/\//g, "").trim();
    if (!id) return null;

    let title = item.querySelector(".comic__title a, .comic__title, .title")?.text?.trim() ||
                item.querySelector("img")?.attributes?.alt?.trim() || "";
    if (!title) return null;

    let img = item.querySelector("img");
    let cover = img?.attributes?.["data-src"] || img?.attributes?.["src"] || "";
    let subtitle = item.querySelector(".comic-feature, .comic__feature, .sub-title")?.text?.trim() || "";
    let update = item.querySelector(".comic-update a, .comic-update, .cover__tag, .update")?.text?.trim() || "";
    let count = item.querySelector(".comic-count, .cover__score")?.text?.trim() || "";

    let desc = update ? (count ? `${update} · ${count}` : update) : count;

    return new Comic({
      id: id,
      title: title,
      subTitle: subtitle,
      cover: this.fixUrl(cover),
      tags: [],
      description: desc
    });
  }

  explore = [{
    title: "漫客栈",
    type: "multiPartPage",
    load: async (page) => {
      let res = await Network.get(this.baseUrl, this.headers);
      if (res.status !== 200) throw `首页加载失败: ${res.status}`;

      let doc = new HtmlDocument(res.body);
      try {
        const result = [];

        // 提取首页各个板块
        let sections = doc.querySelectorAll(".in-sec-wr");
        for (let sec of sections) {
          let headText = sec.querySelector(".in-sec__head")?.text?.trim() || "";
          headText = headText.replace(/更多.*$/, "").replace(/\s+/g, "").trim();
          if (!headText || headText.includes("排行榜")) continue;

          let rawItems = sec.querySelectorAll(".in-comic--type-a, .in-comic--type-b, .common-comic-item");
          let list = [];
          for (let item of rawItems) {
            let comic = this.parseComicCard(item);
            if (comic && !list.some(c => c.id === comic.id)) {
              list.push(comic);
            }
          }

          if (list.length > 0) {
            let fitted = fitToRow(list, 16);
            if (fitted.length > 0) {
              result.push({
                title: headText,
                comics: fitted,
                viewMore: null
              });
            }
          }
        }

        return result;
      } finally {
        doc.dispose();
      }
    }
  }];

  category = {
    title: "漫客栈",
    parts: [
      {
        name: "题材",
        type: "fixed",
        categories: [
          "全部", "霸总", "修真", "恋爱", "校园", "冒险", "搞笑", "生活", "热血", "架空",
          "后宫", "玄幻", "悬疑", "恐怖", "灵异", "动作", "科幻", "战争", "古风", "穿越",
          "竞技", "励志", "同人", "真人"
        ],
        itemType: "category",
        categoryParams: [
          "", "1", "2", "3", "4", "5", "6", "7", "8", "9",
          "10", "12", "13", "14", "15", "16", "17", "18", "19", "20",
          "21", "23", "24", "26"
        ]
      },
      {
        name: "受众",
        type: "fixed",
        categories: ["全部", "少年", "少女", "青年", "少儿"],
        itemType: "category",
        categoryParams: ["", "aud:1", "aud:2", "aud:3", "aud:4"]
      },
      {
        name: "版权",
        type: "fixed",
        categories: ["全部", "独家", "合作"],
        itemType: "category",
        categoryParams: ["", "cpr:1", "cpr:2"]
      }
    ]
  };

  categoryComics = {
    optionList: [
      {
        label: "进度",
        options: ["-全部", "1-连载", "2-完结"]
      },
      {
        label: "资费",
        options: ["-全部", "free-免费", "fee-付费", "vip-VIP"]
      },
      {
        label: "排序",
        options: ["1-热门人气", "2-更新时间"]
      }
    ],

    load: async (category, param, options, page) => {
      let pageNum = typeof page === "number" ? page : (parseInt(page) || 1);
      if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

      let params = [];
      if (param) {
        if (param.startsWith("aud:")) {
          params.push(`audience=${param.substring(4)}`);
        } else if (param.startsWith("cpr:")) {
          params.push(`copyright=${param.substring(4)}`);
        } else {
          params.push(`theme_id=${param}`);
        }
      }

      if (options && options.length > 0) {
        let finish = options[0];
        if (finish) params.push(`finish=${finish}`);

        let fee = options[1];
        if (fee === "free") params.push("is_free=1");
        else if (fee === "fee") params.push("is_fee=1");
        else if (fee === "vip") params.push("is_vip=1");

        let order = options[2] || "1";
        if (order) params.push(`order=${order}`);
      } else {
        params.push("order=1");
      }

      params.push(`page=${pageNum}`);

      let url = `${this.baseUrl}/category/?${params.join("&")}`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `分类加载失败: ${res.status}`;

      let doc = new HtmlDocument(res.body);
      try {
        let items = doc.querySelectorAll(".common-comic-item, .cate-comic-list .common-comic-item");
        let comics = [];
        for (let item of items) {
          let c = this.parseComicCard(item);
          if (c && !comics.some(existing => existing.id === c.id)) {
            comics.push(c);
          }
        }

        let maxPage = comics.length >= 30 ? pageNum + 1 : pageNum;
        return {
          comics: comics,
          maxPage: maxPage
        };
      } finally {
        doc.dispose();
      }
    }
  };

  search = {
    load: async (keyword, options, page) => {
      let pageNum = typeof page === "number" ? page : (parseInt(page) || 1);
      if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

      let q = encodeURIComponent(keyword.trim());
      let url = `${this.baseUrl}/search/?keyword=${q}&page=${pageNum}`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `搜索请求失败: ${res.status}`;

      // 规避无搜索结果时的“猜你喜欢”假推荐
      if (res.body.includes("很遗憾，您搜索的内容暂时没有找到") || res.body.includes('data-count="0"')) {
        return {
          comics: [],
          maxPage: 1
        };
      }

      let doc = new HtmlDocument(res.body);
      try {
        let items = doc.querySelectorAll(".search-comic-list .common-comic-item");
        let comics = [];
        for (let item of items) {
          let c = this.parseComicCard(item);
          if (c && !comics.some(existing => existing.id === c.id)) {
            comics.push(c);
          }
        }

        let maxPage = comics.length >= 20 ? pageNum + 1 : pageNum;
        return {
          comics: comics,
          maxPage: maxPage
        };
      } finally {
        doc.dispose();
      }
    }
  };

  comic = {
    loadInfo: async (id) => {
      // 1. 获取详情页 HTML
      let pageUrl = `${this.baseUrl}/${id}/`;
      let res = await Network.get(pageUrl, this.headers);
      if (res.status !== 200) throw `详情加载失败: ${res.status}`;

      let doc = new HtmlDocument(res.body);
      let title = id;
      let cover = "";
      let author = "";
      let description = "";
      let status = "";
      let tagsList = [];

      try {
        title = doc.querySelector(".j-comic-title, .comic-title")?.text?.trim() || id;
        let img = doc.querySelector(".de-info__cover img");
        cover = this.fixUrl(img?.attributes?.["data-src"] || img?.attributes?.["src"] || "");
        author = doc.querySelector(".comic-author .name")?.text?.trim() || "";
        description = doc.querySelector(".comic-intro .intro-total, .comic-intro .intro")?.text?.trim() || "";
        status = doc.querySelector(".comic-status")?.text?.replace(/\s+/g, " ")?.trim() || "";

        let themeNodes = doc.querySelectorAll(".comic-status span.text b");
        for (let n of themeNodes) {
          let t = n.text?.trim();
          if (t) tagsList.push(...t.split(/\s+/));
        }
      } finally {
        doc.dispose();
      }

      // 2. 调用 API 获取真实章节列表（结构完整、支持鉴权标记）
      let chapters = new Map();
      let chApiUrl = `${this.apiBase}/chapter/v1/?comic_id=${id}`;
      let chRes = await Network.get(chApiUrl, this.headers);

      if (chRes.status === 200) {
        try {
          let chJson = JSON.parse(chRes.body);
          if (chJson.code === "200" && Array.isArray(chJson.data)) {
            for (let ch of chJson.data) {
              let tag = "";
              if (ch.is_vip === "1") {
                tag = " [VIP]";
              } else if (ch.price && ch.price !== "0") {
                tag = " [付费]";
              }
              chapters.set(ch.chapter_id.toString(), `${ch.title}${tag}`);
            }
          }
        } catch (e) {
          // JSON 容错
        }
      }

      // 若 API 未获取到，回退尝试页面解析章节
      if (chapters.size === 0) {
        let doc2 = new HtmlDocument(res.body);
        try {
          let links = doc2.querySelectorAll(".j-chapter-item a.j-chapter-link, .chapter__list-box a");
          for (let a of links) {
            let cid = a.attributes["data-chapterid"] || a.attributes.href?.split("/").pop()?.replace(".html", "");
            let ctitle = a.text?.trim() || cid;
            if (cid && ctitle) {
              chapters.set(cid, ctitle);
            }
          }
        } finally {
          doc2.dispose();
        }
      }

      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: {
          "作者": author ? [author] : [],
          "题材": tagsList.filter(Boolean),
          "状态": status ? [status] : []
        },
        chapters: chapters
      });
    },

    loadEp: async (comicId, epId) => {
      let url = `${this.apiBase}/chapter/content/v1/?chapter_id=${epId}&comic_id=${comicId}&quality=1&type=1&format=1`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `章节请求失败: ${res.status}`;

      let data;
      try {
        data = JSON.parse(res.body);
      } catch (e) {
        throw "解析章节数据失败";
      }

      // 友好处理 VIP 及未购买拦截
      if (data.code === "302" || data.code === "102" || data.code === "103") {
        throw "该章节为漫客栈 VIP/付费章节（服务端鉴权拦截），非登录付费用户无法直接阅读";
      }

      if (data.code !== "200" || !data.data || !Array.isArray(data.data.page)) {
        throw data.message || "章节内容加载失败";
      }

      let images = data.data.page.map(p => this.fixUrl(p.image));
      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => ({
      url: url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.mkzhan.com/"
      }
    }),

    onThumbnailLoad: (url) => ({
      url: url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.mkzhan.com/"
      }
    })
  };
}
