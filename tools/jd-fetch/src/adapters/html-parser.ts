const stripTags = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
};

const findByClassName = (html: string, className: string): string => {
  const regex = new RegExp(
    `<([a-z0-9]+)[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    "i",
  );
  const match = html.match(regex);
  return match ? stripTags(match[2]) : "";
};

const findByDataAttribute = (html: string, attr: string, value: string): string => {
  const regex = new RegExp(
    `<([a-z0-9]+)[^>]*${attr}=["']${value}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    "i",
  );
  const match = html.match(regex);
  return match ? stripTags(match[2]) : "";
};

const findTagText = (html: string, tagName: string): string => {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(regex);
  return match ? stripTags(match[1]) : "";
};

export const extractBySelectors = (
  html: string,
  selectors: Array<{ type: "class"; value: string } | { type: "data"; attr: string; value: string } | { type: "tag"; value: string }>,
): string => {
  for (const selector of selectors) {
    let text = "";

    if (selector.type === "class") {
      text = findByClassName(html, selector.value);
    } else if (selector.type === "data") {
      text = findByDataAttribute(html, selector.attr, selector.value);
    } else {
      text = findTagText(html, selector.value);
    }

    if (text) {
      return text;
    }
  }

  return "";
};
