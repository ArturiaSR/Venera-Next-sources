/** @type {import('./_venera_.js')} */
class MangaDex extends ComicSource {
  name = "MangaDex";
  key = "mangadex";
  version = "1.2.0";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/mangadex.js";

  apiUrl = "https://api.mangadex.org";

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };
  }

  async request(endpoint, params = {}) {
    const url = new URL(`${this.apiUrl}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    const res = await Network.get(url.toString(), this.headers);
    if (res.status !== 200) throw `API 请求失败: ${res.status}`;
    return JSON.parse(res.body);
  }

  parseManga(data) {
    const attrs = data.attributes;
    const id = data.id;
    const title = attrs.title?.en || attrs.title?.ja || attrs.title?.["zh-HK"] || attrs.title?.["zh-CN"] || Object.values(attrs.title)[0] || "Unknown";
    const desc = attrs.description?.en || attrs.description?.ja || attrs.description?.["zh-HK"] || attrs.description?.["zh-CN"] || Object.values(attrs.description || {})[0] || "";
    const coverRel = attrs.coverArt;
    let cover = "";
    if (coverRel) {
      // 需要单独请求封面信息
      cover = `https://uploads.mangadex.org/covers/${id}/${coverRel}`;
    }
    const tags = [];
    if (attrs.tags) {
      for (const tag of attrs.tags) {
        if (tag.attributes.name.en) tags.push(tag.attributes.name.en);
      }
    }
    return new Comic({
      id, title,
      subTitle: attrs.originalLanguage || "",
      cover,
      tags,
      description: desc
    });
  }

  explore = [{
    title: "MangaDex",
    type: "multiPartPage",
    load: async (page) => {
      const result = {};
      // Latest updates
      const latest = await this.request("/manga", {
        "includes[]": "cover_art",
        "order[latestUploadedChapter]": "desc",
        limit: 20,
        offset: (page - 1) * 20
      });
      if (latest.data?.length) {
        result["最新更新"] = latest.data.map(d => this.parseManga(d));
      }
      // Most followed
      if (page === 1) {
        const popular = await this.request("/manga", {
          "includes[]": "cover_art",
          "order[followedCount]": "desc",
          limit: 20
        });
        if (popular.data?.length) {
          result["最受欢迎"] = popular.data.map(d => this.parseManga(d));
        }
      }
      return result;
    }
  }];

  category = null;

  search = {
    load: async (keyword, options, page) => {
      const res = await this.request("/manga", {
        title: keyword,
        "includes[]": "cover_art",
        limit: 20,
        offset: (page - 1) * 20,
        "contentRating[]": ["safe", "suggestive", "erotica"] // 可配置
      });
      return {
        comics: res.data?.map(d => this.parseManga(d)) || [],
        maxPage: Math.ceil((res.total || 0) / 20)
      };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const data = await this.request(`/manga/${id}`, {
        "includes[]": ["cover_art", "author", "artist", "scanlation_group"]
      });
      const manga = data.data;
      const attrs = manga.attributes;
      
      const title = attrs.title?.en || attrs.title?.ja || attrs.title?.["zh-HK"] || attrs.title?.["zh-CN"] || Object.values(attrs.title)[0];
      const desc = attrs.description?.en || attrs.description?.ja || attrs.description?.["zh-HK"] || attrs.description?.["zh-CN"] || Object.values(attrs.description || {})[0] || "";
      const coverRel = manga.relationships?.find(r => r.type === "cover_art")?.attributes?.fileName;
      const cover = coverRel ? `https://uploads.mangadex.org/covers/${id}/${coverRel}` : "";
      
      const tags = [];
      if (attrs.tags) {
        for (const tag of attrs.tags) {
          if (tag.attributes.name.en) tags.push(tag.attributes.name.en);
        }
      }
      
      const authors = manga.relationships?.filter(r => r.type === "author" || r.type === "artist")
        .map(r => r.attributes?.name).filter(Boolean) || [];
      
      // 获取章节
      const chapters = new Map();
      let offset = 0;
      const limit = 100;
      while (true) {
        const chapRes = await this.request(`/manga/${id}/feed`, {
          "translatedLanguage[]": ["en", "zh", "zh-HK", "zh-CN"],
          limit,
          offset,
          order: { chapter: "asc" }
        });
        if (!chapRes.data?.length) break;
        for (const chap of chapRes.data) {
          const chapAttrs = chap.attributes;
          const chapNum = chapAttrs.chapter || "0";
          const chapTitle = chapAttrs.title || `第 ${chapNum} 话`;
          chapters.set(chap.id, chapTitle);
        }
        if (chapRes.data.length < limit) break;
        offset += limit;
      }

      return new ComicDetails({
        title,
        cover,
        description: desc,
        tags: { 标签: tags, 作者: authors, 语言: [attrs.originalLanguage] },
        chapters,
        updateTime: attrs.latestUploadedChapter || "",
        url: `https://mangadex.org/title/${id}`
      });
    },

    loadEp: async (comicId, epId) => {
      const atHome = await this.request(`/at-home/server/${epId}`);
      const baseUrl = atHome.baseUrl;
      const chapter = atHome.chapter;
      const hash = chapter.hash;
      const data = chapter.data;
      const dataSaver = chapter.dataSaver;
      
      const images = data.map(page => 
        `${baseUrl}/${dataSaver ? "data-saver" : "data"}/${hash}/${page}`
      );
      
      return { images };
    }
  };
}
