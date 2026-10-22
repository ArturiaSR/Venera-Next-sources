/** @type {import('./_venera_.js')} */
class Bukamh extends ComicSource {
  name = "布卡漫画";
  key = "bukamh";
  version = "1.0.3";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@bukamh-v1.0.3/bukamh.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://www.bukamh.com", text: "https://www.bukamh.com (主站)" },
        { value: "https://bukamh.com", text: "https://bukamh.com (备用)" }
      ],
      default: "https://www.bukamh.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://www.bukamh.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "http_client": "dart:io"
    };
  }

  isCloudflare(status, body) {
    return (status === 403 || status === 503) &&
      (body.includes("challenge-platform") || body.includes("cloudflare") || body.includes("Just a moment..."));
  }

  fitToRow(list, max = 12) {
    const count = Math.min(list.length, max);
    const rows = Math.floor(count / 4);
    return list.slice(0, Math.max(rows * 4, 0));
  }

  fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.baseUrl.replace(/\/$/, "") + "/" + u.replace(/^\//, "");
  }

  parseComic(item) {
    const link = item.querySelector("a.pic, a.img, .pic a, a.name, a.txt, a");
    if (!link) return null;
    const href = link.attributes.href || "";
    const id = href.replace(/^\/+/, "").replace(/\.html$/, "").replace(/^comic\//, "");
    if (!id || id.startsWith("category") || id.startsWith("custom") || id.startsWith("index") || id.startsWith("redirect")) {
      return null;
    }

    const title = item.querySelector(".name, .txt, .title, h3, h4, img")?.attributes?.alt?.trim()
      || item.querySelector(".name, .txt, .title, h3, h4")?.text?.trim()
      || link.attributes.title?.trim()
      || link.text?.trim()
      || id;

    const img = item.querySelector("img");
    const cover = img?.attributes["data-src"] || img?.attributes["data-original"] || img?.attributes["src"] || "";
    const author = (item.querySelector(".author, .tage, .book-author")?.text?.trim() || "").toString();
    const update = (item.querySelector(".info, .update, .chapter, .latest")?.text?.trim() || "").toString();

    return new Comic({
      id: String(id),
      title: String(title),
      subtitle: String(author),
      subTitle: String(author),
      cover: this.fixUrl(cover),
      tags: [],
      description: String(update || author)
    });
  }

  decryptParams(paramsStr) {
    const rawBuffer = Convert.decodeBase64(paramsStr);
    const rawBytes = new Uint8Array(rawBuffer);
    const iv = rawBytes.slice(0, 16).buffer;
    const ciphertext = rawBytes.slice(16).buffer;
    const key = Convert.encodeUtf8("9S8$vJnU2ANeSRoF");

    const decryptedBuffer = Convert.decryptAesCbc(ciphertext, key, iv);
    const decryptedBytes = new Uint8Array(decryptedBuffer);

    const padLen = decryptedBytes[decryptedBytes.length - 1];
    let unpaddedBytes = decryptedBytes;
    if (padLen > 0 && padLen <= 16) {
      let valid = true;
      for (let i = decryptedBytes.length - padLen; i < decryptedBytes.length; i++) {
        if (decryptedBytes[i] !== padLen) {
          valid = false;
          break;
        }
      }
      if (valid) {
        unpaddedBytes = decryptedBytes.slice(0, decryptedBytes.length - padLen);
      }
    }

    const jsonStr = Convert.decodeUtf8(unpaddedBytes.buffer);
    return JSON.parse(jsonStr);
  }

  explore = [
    {
      title: "布卡漫画",
      type: "multiPartPage",
      load: async () => {
        const res = await Network.get(this.baseUrl, this.headers);
        if (this.isCloudflare(res.status, res.body)) {
          throw "触发 Cloudflare 5秒盾，请稍后再试。";
        }
        if (res.status !== 200) throw `加载发现页失败: ${res.status}`;

        const doc = new HtmlDocument(res.body);
        try {
          const parts = [];
          const boxes = doc.querySelectorAll(".comic_box");
          for (const box of boxes) {
            const titleEl = box.querySelector(".title .h2, .title span:not(.icon)");
            const sectionTitle = titleEl?.text?.trim() || "精选推荐";
            const items = box.querySelectorAll("ul li");
            const comics = items.map(e => this.parseComic(e)).filter(Boolean);
            if (comics.length > 0) {
              const fitted = this.fitToRow(comics, 12);
              if (fitted.length > 0) {
                parts.push({
                  title: sectionTitle,
                  comics: fitted,
                  viewMore: null
                });
              }
            }
          }
          return parts;
        } finally {
          doc.dispose();
        }
      }
    }
  ];

  category = {
    title: "布卡漫画",
    parts: [
      {
        name: "题材",
        type: "fixed",
        categories: [
          "爆笑", "生活", "灵异", "神魔", "日常", "总裁", "修真", "精品",
          "战斗", "漫改", "新作", "神仙", "改编", "校园", "治愈", "霸总",
          "爆更", "社会", "防疫", "剧情", "美食", "奇幻", "恐怖", "动作"
        ],
        itemType: "category",
        categoryParams: [
          "tags/215", "tags/216", "tags/217", "tags/218", "tags/219", "tags/220",
          "tags/221", "tags/222", "tags/223", "tags/224", "tags/225", "tags/226",
          "tags/227", "tags/228", "tags/229", "tags/230", "tags/231", "tags/232",
          "tags/233", "tags/234", "tags/235", "tags/236", "tags/237", "tags/238"
        ]
      },
      {
        name: "读者群",
        type: "fixed",
        categories: ["国产漫画", "日本漫画", "韩国漫画", "欧美漫画"],
        itemType: "category",
        categoryParams: ["list/1", "list/2", "list/3", "list/4"]
      },
      {
        name: "进度",
        type: "fixed",
        categories: ["连载", "完结"],
        itemType: "category",
        categoryParams: ["finish/1", "finish/2"]
      },
      {
        name: "地区",
        type: "fixed",
        categories: ["内地", "港台", "韩国", "日本", "欧美"],
        itemType: "category",
        categoryParams: ["city/42", "city/43", "city/44", "city/45", "city/134"]
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let path = "";
      if (param && param !== "all") {
        path = `/category/${param}`;
      } else {
        path = `/category`;
      }

      const pageNum = typeof page === "number" ? page : parseInt(page) || 1;
      const url = pageNum > 1 ? `${this.baseUrl}${path}/page/${pageNum}` : `${this.baseUrl}${path}`;
      const res = await Network.get(url, this.headers);
      if (this.isCloudflare(res.status, res.body)) {
        throw "触发 Cloudflare 5秒盾，请稍后再试。";
      }
      if (res.status !== 200) throw `加载分类失败: ${res.status}`;

      const doc = new HtmlDocument(res.body);
      try {
        const items = doc.querySelectorAll(".catagory-list li, .u_list li, .comic-list li, .book-list li");
        const comics = items.map(e => this.parseComic(e)).filter(Boolean);

        let maxPage = pageNum;
        const pagebox = doc.querySelector(".pagebox:not(.yc)");
        if (pagebox) {
          const numText = pagebox.querySelector(".datanum")?.text || "";
          const m = numText.match(/共\s*(\d+)\s*页/);
          if (m) {
            const p = parseInt(m[1]);
            maxPage = !isNaN(p) && p > 0 ? p : pageNum;
          } else {
            const lastLink = pagebox.querySelector("a:last-child")?.attributes?.href || "";
            const pm = lastLink.match(/page\/(\d+)/);
            if (pm) {
              const p = parseInt(pm[1]);
              maxPage = !isNaN(p) && p > 0 ? p : pageNum;
            }
          }
        }
        if (comics.length > 0 && maxPage < pageNum) {
          maxPage = pageNum + 1;
        }

        return { comics, maxPage };
      } finally {
        doc.dispose();
      }
    }
  };

  search = {
    load: async (keyword, options, page) => {
      const trimmed = keyword ? keyword.trim() : "";
      if (!trimmed) {
        return { comics: [], maxPage: 1 };
      }

      const pageNum = typeof page === "number" ? page : parseInt(page) || 1;
      const url = pageNum > 1
        ? `${this.baseUrl}/index.php/search?key=${encodeURIComponent(trimmed)}&page=${pageNum}`
        : `${this.baseUrl}/index.php/search?key=${encodeURIComponent(trimmed)}`;

      const fetchSearch = async () => {
        return await Network.get(url, {
          ...this.headers,
          "Referer": `${this.baseUrl}/custom/search`
        });
      };

      let res = await fetchSearch();

      if (this.isCloudflare(res.status, res.body)) {
        throw "触发 Cloudflare 5秒盾，请稍后再试。";
      }

      // 如果遇到原站频控“搜索繁忙”，自动延时 4.5 秒重试 1 次
      if (res.body.includes('"搜索繁忙"')) {
        await new Promise((resolve) => setTimeout(resolve, 4500));
        res = await fetchSearch();
      }

      if (this.isCloudflare(res.status, res.body)) {
        throw "触发 Cloudflare 5秒盾，请稍后再试。";
      }
      if (res.status !== 200) throw `搜索请求失败: ${res.status}`;

      if (res.body.includes('"搜索繁忙"')) {
        throw "布卡漫画原站搜索过于频繁（频控限制），请等待 5-10 秒后再试，建议使用核心关键词搜索。";
      }

      const doc = new HtmlDocument(res.body);
      try {
        const titleText = doc.querySelector(".u_list .title")?.text || "";
        if (titleText.includes("共有 0 本漫画") || res.body.includes("共有<span style=\"color: red;\"> 0 </span>本漫画")) {
          return { comics: [], maxPage: 1 };
        }

        const items = doc.querySelectorAll(".u_list li, .catagory-list li");
        const comics = items.map(e => this.parseComic(e)).filter(Boolean);

        let maxPage = 1;
        const datanum = doc.querySelector(".pagebox .datanum")?.text || "";
        const m = datanum.match(/共\s*(\d+)\s*页/);
        if (m) {
          const p = parseInt(m[1]);
          maxPage = !isNaN(p) && p > 0 ? p : 1;
        }

        return { comics, maxPage };
      } finally {
        doc.dispose();
      }
    }
  };

  comic = {
    loadInfo: async (id) => {
      const cleanId = id.replace(/^\/+/, "").replace(/\.html$/, "");
      const url = `${this.baseUrl}/${cleanId}`;
      const res = await Network.get(url, this.headers);
      if (this.isCloudflare(res.status, res.body)) {
        throw "触发 Cloudflare 5秒盾，请稍后再试。";
      }
      if (res.status !== 200) throw `详情加载失败: ${res.status}`;

      const doc = new HtmlDocument(res.body);
      try {
        const title = doc.querySelector(".infobox .title, h1, .detail-title")?.text?.trim() || cleanId;
        const cover = doc.querySelector(".infobox .img img, .detail-cover img")?.attributes?.src || "";

        const tages = doc.querySelectorAll(".infobox .info .tage");
        let author = "";
        let updateTime = "";
        let status = "";
        const tagList = [];

        for (const t of tages) {
          const text = t.text.trim();
          if (text.startsWith("作者：")) {
            author = text.replace("作者：", "").trim();
          } else if (text.startsWith("更新于：")) {
            updateTime = text.replace("更新于：", "").trim();
          } else if (text.startsWith("更新至：")) {
            status = text.replace("更新至：", "").trim();
          } else if (text.startsWith("类型：")) {
            const typeLinks = t.querySelectorAll("a");
            for (const a of typeLinks) {
              const val = a.text.trim();
              if (val) tagList.push(val);
            }
          }
        }

        const description = doc.querySelector(".infocomic .text, .book-intro, .intro")?.text?.trim() || "";

        const chapters = {};
        const chapterLinks = doc.querySelectorAll(".chapterbox .list li a, .chapter-list a, .catalog a");
        for (const link of chapterLinks) {
          const href = link.attributes.href || "";
          const cid = href.replace(/^\/+/, "").replace(/\.html$/, "");
          const ctitle = link.text.trim();
          if (cid && ctitle) {
            chapters[cid] = ctitle;
          }
        }

        const tags = {};
        if (author) tags["作者"] = [author];
        if (status) tags["状态"] = [status];
        if (tagList.length > 0) tags["题材"] = tagList;
        if (updateTime) tags["更新时间"] = [updateTime];

        return new ComicDetails({
          title: String(title),
          subtitle: String(author),
          subTitle: String(author),
          cover: this.fixUrl(cover),
          description: String(description),
          tags,
          chapters,
          updateTime: String(updateTime || status)
        });
      } finally {
        doc.dispose();
      }
    },

    loadEp: async (comicId, epId) => {
      const cleanEp = epId.replace(/^\/+/, "").replace(/\.html$/, "");
      const url = `${this.baseUrl}/${cleanEp}.html`;
      const res = await Network.get(url, this.headers);
      if (this.isCloudflare(res.status, res.body)) {
        throw "触发 Cloudflare 5秒盾，请稍后再试。";
      }
      if (res.status !== 200) throw `章节加载失败: ${res.status}`;

      const m = res.body.match(/params\s*=\s*'([^']+)'/);
      if (!m) {
        throw "无法从章节页面提取图片加密数据";
      }

      const data = this.decryptParams(m[1]);
      if (!data || !data.images || data.images.length === 0) {
        throw "解密失败或章节图片为空";
      }

      const images = data.images.map(img => {
        if (!img) return "";
        if (img.startsWith("http://") || img.startsWith("https://")) return img;
        if (img.startsWith("//")) return "https:" + img;
        return "https://img1.baipiaoguai.org" + (img.startsWith("/") ? "" : "/") + img;
      }).filter(Boolean);

      return { images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": ""
        }
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": ""
        }
      };
    }
  };
}
