/** @type {import('./_venera_.js')} */

function fitToRow(list, max) {
  if (!list || list.length === 0) return [];
  const count = Math.min(list.length, max || list.length);
  const validCount = Math.floor(count / 4) * 4;
  return validCount > 0 ? list.slice(0, validCount) : list.slice(0, count);
}

function unpack(p, a, c, k) {
  let d = {};
  let e = function (c) {
    return (c < a ? "" : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
  };
  if (!"".replace(/^/, String)) {
    while (c--) d[e(c)] = k[c] || e(c);
    k = [function (e) { return d[e]; }];
    e = function () { return "\\w+"; };
    c = 1;
  }
  while (c--) {
    if (k[c]) p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
  }
  return p;
}

class Jisumh extends ComicSource {
  name = "极速漫画";
  key = "jisumh";
  version = "1.0.2";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@jisumh-v1.0.2/jisumh.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://m.1kkk.com", text: "https://m.1kkk.com (手机端)" }
      ],
      default: "https://m.1kkk.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://m.1kkk.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Referer": this.baseUrl + "/"
    };
  }

  fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.baseUrl.replace(/\/$/, "") + "/" + u.replace(/^\//, "");
  }

  parseComicItem(li) {
    const link = li.querySelector("a[href*='/manhua']");
    if (!link) return null;
    const href = link.attributes.href || "";
    const id = href.replace(/^\//, "").replace(/\/$/, "");
    if (!id) return null;
    const title = li.querySelector(".manga-list-1-title, .manga-list-2-title, .book-list-info-title, h3, h4")?.text?.trim()
      || link.attributes.title
      || link.text.trim();
    const cover = li.querySelector("img")?.attributes?.src
      || li.querySelector("img")?.attributes?.["data-src"] || "";
    const subTitle = li.querySelector(".manga-list-1-tip, .manga-list-2-tip, .book-list-info-bottom")?.text?.trim() || "";
    const desc = li.querySelector(".book-list-info-desc")?.text?.trim() || "";
    if (!title) return null;
    return new Comic({
      id,
      title,
      subTitle,
      cover: this.fixUrl(cover),
      tags: [],
      description: desc
    });
  }

  explore = [{
    title: "极速漫画",
    type: "multiPartPage",
    load: async (page) => {
      let res = await Network.get(this.baseUrl, this.headers);
      if (res.status !== 200) throw `加载首页失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      try {
        const result = [];
        const titleNodes = doc.querySelectorAll(".manga-list-title.index");
        const listNodes = doc.querySelectorAll("ul.manga-list-1, ul.manga-list-2");

        for (let i = 0; i < titleNodes.length && i < listNodes.length; i++) {
          let partTitle = titleNodes[i].text?.replace(/更多$/, "")?.trim() || `分区${i + 1}`;
          let lis = listNodes[i].querySelectorAll("li");
          let comics = [];
          for (let li of lis) {
            let item = this.parseComicItem(li);
            if (item) comics.push(item);
          }
          if (comics.length > 0) {
            result.push({
              title: partTitle,
              comics: fitToRow(comics, 16),
              viewMore: null
            });
          }
        }
        return result;
      } finally {
        doc.dispose();
      }
    }
  }];

  category = {
    title: "极速漫画",
    parts: [
      {
        name: "排序",
        type: "fixed",
        categories: [
          { label: "最热门", target: { page: "category", attributes: { category: "最热门", param: "sort=10" } } },
          { label: "最近更新", target: { page: "category", attributes: { category: "最近更新", param: "sort=2" } } },
          { label: "最新上架", target: { page: "category", attributes: { category: "最新上架", param: "sort=18" } } }
        ]
      },
      {
        name: "状态",
        type: "fixed",
        categories: [
          { label: "全部", target: { page: "category", attributes: { category: "全部", param: "status=0" } } },
          { label: "连载中", target: { page: "category", attributes: { category: "连载中", param: "status=1" } } },
          { label: "已完结", target: { page: "category", attributes: { category: "已完结", param: "status=2" } } }
        ]
      },
      {
        name: "题材",
        type: "fixed",
        categories: [
          { label: "全部", target: { page: "category", attributes: { category: "全部", param: "tagid=0" } } },
          { label: "热血", target: { page: "category", attributes: { category: "热血", param: "tagid=31" } } },
          { label: "恋爱", target: { page: "category", attributes: { category: "恋爱", param: "tagid=26" } } },
          { label: "校园", target: { page: "category", attributes: { category: "校园", param: "tagid=1" } } },
          { label: "冒险", target: { page: "category", attributes: { category: "冒险", param: "tagid=2" } } },
          { label: "后宫", target: { page: "category", attributes: { category: "后宫", param: "tagid=8" } } },
          { label: "科幻", target: { page: "category", attributes: { category: "科幻", param: "tagid=25" } } },
          { label: "悬疑", target: { page: "category", attributes: { category: "悬疑", param: "tagid=17" } } },
          { label: "搞笑", target: { page: "category", attributes: { category: "搞笑", param: "tagid=37" } } },
          { label: "奇幻", target: { page: "category", attributes: { category: "奇幻", param: "tagid=14" } } },
          { label: "魔法", target: { page: "category", attributes: { category: "魔法", param: "tagid=15" } } },
          { label: "神鬼", target: { page: "category", attributes: { category: "神鬼", param: "tagid=20" } } },
          { label: "日漫", target: { page: "category", attributes: { category: "日漫", param: "areaid=36" } } }
        ]
      }
    ]
  };

  categoryComics = {
    load: async (category, params, options, page) => {
      let sort = "10";
      let status = "0";
      let tagid = "0";
      let areaid = "0";

      if (params) {
        let pairs = params.split("&");
        for (let pair of pairs) {
          let [k, v] = pair.split("=");
          if (k === "sort") sort = v;
          if (k === "status") status = v;
          if (k === "tagid") tagid = v;
          if (k === "areaid") areaid = v;
        }
      }

      let postData = `action=getclasscomics&pageindex=${page}&pagesize=21&categoryid=0&tagid=${tagid}&status=${status}&usergroup=0&pay=-1&areaid=${areaid}&sort=${sort}&iscopyright=0`;
      let res = await Network.post(
        `${this.baseUrl}/dm5.ashx?d=${Date.now()}`,
        {
          ...this.headers,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        postData
      );

      if (res.status !== 200) throw `加载分类失败: ${res.status}`;
      let data = JSON.parse(res.body);
      let items = data.UpdateComicItems || [];

      let comics = items.map(item => {
        let authorStr = "";
        if (Array.isArray(item.Author)) {
          authorStr = item.Author.join(", ");
        } else if (typeof item.Author === "string") {
          authorStr = item.Author;
        } else if (item.ShowLastPartName) {
          authorStr = item.ShowLastPartName;
        }

        return new Comic({
          id: item.UrlKey,
          title: item.Title,
          subTitle: authorStr,
          cover: this.fixUrl(item.ShowPicUrlB || item.ShowConver || ""),
          tags: Array.isArray(item.Author) ? item.Author : [],
          description: item.Content || ""
        });
      });

      return {
        comics,
        maxPage: items.length >= 21 ? page + 1 : page
      };
    }
  };

  search = {
    load: async (keyword, options, page) => {
      if (!keyword || !keyword.trim()) return { comics: [], maxPage: 1 };
      let url = `${this.baseUrl}/search?title=${encodeURIComponent(keyword.trim())}&page=${page}`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        if (res.status === 404) return { comics: [], maxPage: 1 };
        throw `搜索失败: ${res.status}`;
      }
      let doc = new HtmlDocument(res.body);
      try {
        let items = doc.querySelectorAll(".book-list-cover");
        if (!items || items.length === 0) {
          return { comics: [], maxPage: page };
        }
        let comics = [];
        for (let item of items) {
          let link = item.querySelector("a");
          if (!link) continue;
          let href = link.attributes.href || "";
          let id = href.replace(/^\//, "").replace(/\/$/, "");
          let title = link.attributes.title || link.text.trim();
          let cover = item.querySelector("img")?.attributes?.src || "";
          let parent = item.parentElement;
          let infoEl = parent ? parent.querySelector(".book-list-info") : null;
          let desc = infoEl?.querySelector(".book-list-info-desc")?.text?.trim() || "";
          let author = infoEl?.querySelector(".book-list-info-bottom")?.text?.trim() || "";
          if (id && title) {
            comics.push(new Comic({
              id,
              title,
              subTitle: typeof author === "string" ? author : "",
              cover: this.fixUrl(cover),
              tags: [],
              description: desc
            }));
          }
        }
        return {
          comics,
          maxPage: comics.length >= 20 ? page + 1 : page
        };
      } finally {
        doc.dispose();
      }
    }
  };

  comic = {
    loadInfo: async (id) => {
      let url = `${this.baseUrl}/${id}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `详情加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      try {
        let title = doc.querySelector(".detail-main-info-title, .book-title, h1")?.text?.trim() || id;
        let cover = doc.querySelector(".detail-main-cover img, .book-cover img")?.attributes?.src || "";
        let author = doc.querySelector(".detail-main-info-author a, .book-author")?.text?.trim() || "";
        let description = doc.querySelector(".detail-desc, .book-intro")?.text?.trim() || "";
        let genres = doc.querySelectorAll(".detail-main-info-class span a").map(e => e.text.trim()).filter(Boolean);

        let chapters = new Map();
        let chapterLinks = doc.querySelectorAll(".detail-list-select a[href*='/ch'], .detail-list-select a[href*='/vol'], .detail-list-select a[href*='/other']");
        for (let link of chapterLinks) {
          let href = link.attributes.href || "";
          let cid = href.replace(/^\//, "").replace(/\/$/, "");
          let ctitle = link.querySelector(".detail-list-1-info-title, .detail-list-2-info-title")?.text?.trim() || link.text.trim();
          if (cid && ctitle && !chapters.has(cid)) {
            chapters.set(cid, ctitle);
          }
        }

        return new ComicDetails({
          title,
          cover: this.fixUrl(cover),
          description,
          tags: {
            "作者": author ? [author] : [],
            "题材": genres
          },
          chapters,
          updateTime: ""
        });
      } finally {
        doc.dispose();
      }
    },

    loadEp: async (comicId, epId) => {
      let url = `${this.baseUrl}/${epId}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `章节加载失败: ${res.status}`;

      if (res.body.includes("需付费后阅读") || res.body.includes("DM5_CHAPTERCOIN")) {
        throw "本章节为付费章节（需次元币购买解锁），极速漫画官方未提供免费阅读内容。";
      }

      let packerMatch = res.body.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
      if (!packerMatch) {
        throw "未找到章节图片数据，可能该章节已下架或需要登录。";
      }

      let p = packerMatch[1];
      let a = parseInt(packerMatch[2]);
      let c = parseInt(packerMatch[3]);
      let k = packerMatch[4].split("|");
      let code = unpack(p, a, c, k);

      let matches = [...code.matchAll(/'(https?:\/\/[^']+)'/g)];
      let images = matches.map(m => this.fixUrl(m[1].replace(/\\+$/, "")));

      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": "https://m.1kkk.com/"
      }
    }),

    onThumbnailLoad: (url) => ({
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": "https://m.1kkk.com/"
      }
    })
  };
}
