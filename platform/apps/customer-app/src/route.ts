/** Customer app URL ↔ screen map (browser Back / Forward). */

export type Tab = "home" | "activity" | "support" | "profile";
export type BookStep = "route" | "package" | "quote" | "done";

export type CustomerRoute =
  | { screen: "home" }
  | { screen: "book"; step: BookStep }
  | { screen: "track"; jobId: string }
  | { screen: "activity" }
  | { screen: "support" }
  | { screen: "support-case"; caseId: string }
  | { screen: "profile" };

const BOOK_STEPS = new Set<BookStep>(["route", "package", "quote", "done"]);

export function pathFromRoute(route: CustomerRoute): string {
  switch (route.screen) {
    case "home":
      return "/";
    case "book":
      return `/book/${route.step}`;
    case "track":
      return `/track/${route.jobId}`;
    case "activity":
      return "/activity";
    case "support":
      return "/support";
    case "support-case":
      return `/support/case/${route.caseId}`;
    case "profile":
      return "/profile";
  }
}

export function routeFromPath(pathname: string): CustomerRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/home") return { screen: "home" };
  if (path === "/activity") return { screen: "activity" };
  if (path === "/profile") return { screen: "profile" };
  if (path === "/support") return { screen: "support" };

  const book = path.match(/^\/book\/(route|package|quote|done)$/);
  if (book && BOOK_STEPS.has(book[1] as BookStep)) {
    return { screen: "book", step: book[1] as BookStep };
  }
  if (path === "/book") return { screen: "book", step: "route" };

  const track = path.match(/^\/track\/([^/]+)$/);
  if (track) return { screen: "track", jobId: decodeURIComponent(track[1]) };

  const supportCase = path.match(/^\/support\/case\/([^/]+)$/);
  if (supportCase) {
    return {
      screen: "support-case",
      caseId: decodeURIComponent(supportCase[1]),
    };
  }

  return { screen: "home" };
}

export function routesEqual(a: CustomerRoute, b: CustomerRoute): boolean {
  return pathFromRoute(a) === pathFromRoute(b);
}
