// HTTP-слой админки: подстановка токена и, главное, ветки протухания.
// Именно здесь система уже спотыкалась — на 401 и обновлении токена.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch, setAuthToken, getAuthToken } from "./authFetch";

const API = "http://api.test/api";

const res = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let fetchMock;
let fakeLocation;

beforeEach(() => {
  setAuthToken(null);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Настоящая navigation в jsdom не реализована и сыплет ошибками в вывод.
  // Подменяем location: заодно получаем возможность проверить сам редирект,
  // а не только его побочные эффекты.
  fakeLocation = { pathname: "/dashboard", href: "http://api.test/dashboard" };
  vi.stubGlobal("location", fakeLocation);
});

const callsTo = (substr) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(substr));

describe("подстановка токена", () => {
  it("прикладывает Authorization, когда токен есть", async () => {
    setAuthToken("tok-1");
    fetchMock.mockResolvedValue(res(200));

    await authFetch("/interns");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/interns`);
    expect(init.headers.Authorization).toBe("Bearer tok-1");
    expect(init.credentials).toBe("include");
  });

  it("без токена заголовка нет", async () => {
    fetchMock.mockResolvedValue(res(200));
    await authFetch("/interns");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("абсолютный URL не префиксуется базой", async () => {
    fetchMock.mockResolvedValue(res(200));
    await authFetch("https://other.test/x");
    expect(fetchMock.mock.calls[0][0]).toBe("https://other.test/x");
  });

  it("чужой Authorization из init вырезается", async () => {
    // Иначе вызывающий код может случайно подсунуть протухший токен и
    // перебить актуальный.
    setAuthToken("tok-1");
    fetchMock.mockResolvedValue(res(200));

    await authFetch("/x", { headers: { Authorization: "Bearer СТАРЫЙ", "X-Keep": "1" } });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer tok-1");
    expect(headers["X-Keep"]).toBe("1");
  });

  it("для FormData не выставляется Content-Type", async () => {
    // multipart без boundary сервер разобрать не сможет — boundary проставляет
    // сам браузер, только если Content-Type не задан вручную.
    setAuthToken("tok-1");
    fetchMock.mockResolvedValue(res(200));

    await authFetch("/uploads", { method: "POST", body: new FormData() });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer tok-1");
  });

  it("setAuthToken / getAuthToken", () => {
    setAuthToken("abc");
    expect(getAuthToken()).toBe("abc");
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });
});

describe("успешный ответ не вызывает обновление токена", () => {
  it("200 отдаётся как есть, запрос один", async () => {
    fetchMock.mockResolvedValue(res(200, { ok: true }));
    const r = await authFetch("/interns");
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("403 не считается протуханием и не обновляет токен", async () => {
    fetchMock.mockResolvedValue(res(403));
    const r = await authFetch("/interns");
    expect(r.status).toBe(403);
    expect(callsTo("refresh-token")).toHaveLength(0);
  });

  it("500 тоже проходит насквозь", async () => {
    fetchMock.mockResolvedValue(res(500));
    expect((await authFetch("/interns")).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("401 → обновление токена", () => {
  it("обновляет токен и повторяет запрос уже с новым", async () => {
    setAuthToken("протухший");
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { token: "свежий" }))
      .mockResolvedValueOnce(res(200, { data: [] }));

    const r = await authFetch("/interns");

    expect(r.status).toBe(200);
    expect(callsTo("refresh-token")).toHaveLength(1);
    // Повтор ушёл с новым токеном, а не со старым.
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer свежий");
    expect(getAuthToken()).toBe("свежий");
  });

  it("обновление возвращает не-ok → отдаём исходный 401 и чистим сессию", async () => {
    localStorage.setItem("user", JSON.stringify({ name: "Бек" }));
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(401));

    const r = await authFetch("/interns");

    expect(r.status).toBe(401);
    expect(localStorage.getItem("user")).toBeNull();
    expect(getAuthToken()).toBeNull();
    expect(fakeLocation.href).toBe("/login");
  });

  it("с /login не редиректит повторно — иначе страница логина зациклится", async () => {
    fakeLocation.pathname = "/login";
    fakeLocation.href = "http://api.test/login";
    fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(401));

    await authFetch("/interns");

    expect(fakeLocation.href).toBe("http://api.test/login");
  });

  it("обновление вернуло 200 без токена — тоже разлогин", async () => {
    localStorage.setItem("user", "{}");
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { нет: "токена" }));

    expect((await authFetch("/interns")).status).toBe(401);
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("сеть отвалилась во время обновления — не бросаем, отдаём 401", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const r = await authFetch("/interns");
    expect(r.status).toBe(401);
  });

  it("битый JSON в ответе обновления не роняет запрос", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => { throw new SyntaxError("Unexpected token"); },
      });

    const r = await authFetch("/interns");
    expect(r.status).toBe(401);
  });
});

describe("миграционный костыль: refreshToken из localStorage", () => {
  it("уходит в тело запроса и после этого удаляется", async () => {
    localStorage.setItem("refreshToken", "старый-refresh");
    localStorage.setItem("token", "старый-access");
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { token: "свежий" }))
      .mockResolvedValueOnce(res(200));

    await authFetch("/interns");

    const [, init] = callsTo("refresh-token")[0];
    expect(JSON.parse(init.body)).toEqual({ refreshToken: "старый-refresh" });
    // Костыль одноразовый: после первого использования чистим, иначе он
    // переживёт ротацию на cookie и будет слаться вечно.
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("без костыля тело пустое", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { token: "t" }))
      .mockResolvedValueOnce(res(200));

    await authFetch("/interns");
    expect(JSON.parse(callsTo("refresh-token")[0][1].body)).toEqual({});
  });

  it("костыль вычищается и когда обновление упало", async () => {
    localStorage.setItem("refreshToken", "старый");
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockRejectedValueOnce(new Error("сеть"));

    await authFetch("/interns");
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });
});

describe("гонка: несколько 401 одновременно", () => {
  it("обновление уходит ОДИН раз на все параллельные запросы", async () => {
    // Ради этого в модуле и живёт очередь waiters. Без неё каждая вкладка
    // и каждый параллельный запрос дёргали бы ротацию refresh-токена, и
    // проигравшие получали бы уже отозванный jti.
    setAuthToken("протухший");
    let releaseRefresh;
    const refreshGate = new Promise((r) => { releaseRefresh = r; });

    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes("refresh-token")) {
        await refreshGate;
        return res(200, { token: "свежий" });
      }
      // Пока токен не обновлён — 401; после — 200.
      return getAuthToken() === "свежий" ? res(200, { ok: true }) : res(401);
    });

    const all = Promise.all([authFetch("/a"), authFetch("/b"), authFetch("/c")]);
    await Promise.resolve();
    releaseRefresh();
    const results = await all;

    expect(callsTo("refresh-token")).toHaveLength(1);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it("если обновление не удалось, ожидающие получают свой 401, а не виснут", async () => {
    let releaseRefresh;
    const refreshGate = new Promise((r) => { releaseRefresh = r; });

    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes("refresh-token")) {
        await refreshGate;
        return res(401);
      }
      return res(401);
    });

    const all = Promise.all([authFetch("/a"), authFetch("/b")]);
    await Promise.resolve();
    releaseRefresh();
    const results = await all;

    expect(results.every((r) => r.status === 401)).toBe(true);
  });
});
