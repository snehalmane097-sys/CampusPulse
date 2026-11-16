// Reload the pages the user has opened; do not collapse a paginated view on a socket refresh.
export async function readFeedWindow(fetchPage: (url: string) => Promise<any>, url: string, key: string, pages = 1) {
  let cursor: string | null = null, first: any, records: any[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < pages; page++) {
    const data = await fetchPage(url + (cursor ? `${url.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : ""));
    first ||= data;
    for (const record of data[key]) if (!seen.has(record._id)) { seen.add(record._id); records.push(record); }
    cursor = data.nextCursor || null;
    if (!cursor) break;
  }
  return { ...first, [key]: records, nextCursor: cursor };
}
