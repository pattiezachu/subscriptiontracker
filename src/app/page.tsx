"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Pencil, CheckCircle2 } from "lucide-react";

type Type = "time" | "usage";

type Item = {
  id: string;
  name: string;
  amount?: number;
  type: Type;
  due?: string; // YYYY-MM-DD
  current?: number;
  unit?: string;
  interval?: number;
  target?: number;
  repeat?: "none" | "monthly" | "yearly" | "biyearly"; // สำหรับตามวันและเวลา
  lastDone?: string; // YYYY-MM-DD
  sortOrder?: number;
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const STORAGE_KEY = "subscription-tracker-items-v1";
const SORT_MODE_KEY = "subscription-tracker-sort-mode-v1";

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortMode, setSortMode] = useState<"auto" | "manual">("auto");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const rawMode = localStorage.getItem(SORT_MODE_KEY);
      if (rawMode === "manual" || rawMode === "auto") {
        setSortMode(rawMode);
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Item[];
        if (Array.isArray(parsed)) {
          setItems(parsed);
          setLoaded(true);
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    // ถ้าไม่มีข้อมูล ให้เริ่มจากข้อมูลตัวอย่าง
    const initial: Item[] = [
      {
        id: "ex1",
        name: "Netflix",
        amount: 349,
        type: "time",
        due: addDays(new Date(), 5),
        repeat: "monthly",
        sortOrder: 0,
      },
      {
        id: "ex2",
        name: "ประกันรถ",
        amount: 8500,
        type: "time",
        due: addDays(new Date(), -2),
        repeat: "yearly",
        sortOrder: 1,
      },
      {
        id: "ex3",
        name: "เปลี่ยนน้ำมันเครื่อง",
        type: "usage",
        current: 45200,
        unit: "กม.",
        interval: 10000,
        target: 55200,
        sortOrder: 2,
      },
    ];
    setItems(initial);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      // ignore
    }
  }, [items, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SORT_MODE_KEY, sortMode);
    } catch (e) {
      // ignore
    }
  }, [sortMode, loaded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotifPermission("unsupported");
      return;
    }
    try {
      setNotifPermission(Notification.permission);
    } catch (e) {
      setNotifPermission("unsupported");
    }
  }, []);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<Type>("time");
  const [due, setDue] = useState(todayStr());
  const [repeat, setRepeat] = useState<"none" | "monthly" | "yearly" | "biannual" | "biyearly">("monthly");
  const [current, setCurrent] = useState("");
  const [unit, setUnit] = useState("กม.");
  const [interval, setInterval] = useState("");
  const [target, setTarget] = useState("");

  const displayItems = useMemo(() => {
    if (sortMode === "manual") {
      const list = [...items];
      list.sort((a, b) => {
        const ao = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER;
        const bo = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return 0;
      });
      if (list.every((it) => typeof it.sortOrder !== "number")) {
        list.forEach((it, idx) => {
          it.sortOrder = idx;
        });
      }
      return list;
    }
    return [...items].sort((a, b) => {
      const ta = a.type === "time";
      const tb = b.type === "time";
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      if (ta && tb) {
        const da = a.due ? new Date(a.due + "T00:00:00").getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.due ? new Date(b.due + "T00:00:00").getTime() : Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return 0;
      }
      const ra = typeof a.target === "number" && typeof a.current === "number" ? (a.target - a.current) : Number.MAX_SAFE_INTEGER;
      const rb = typeof b.target === "number" && typeof b.current === "number" ? (b.target - b.current) : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  }, [items, sortMode]);

  const { monthlyAvg, yearlyTotal } = useMemo(() => {
    let monthly = 0;
    let yearly = 0;
    for (const it of items) {
      if (typeof it.amount !== "number") continue;
      if (it.type === "time") {
        if (it.repeat === "monthly") {
          monthly += it.amount;
          yearly += it.amount * 12;
        } else if (it.repeat === "yearly") {
          monthly += it.amount / 12;
          yearly += it.amount;
        } else if (it.repeat === "biyearly") {
          monthly += it.amount / 24;
          yearly += it.amount / 2;
        } else if (it.repeat === "none") {
          // รายการครั้งเดียว ไม่รวมในสรุปค่าใช้จ่ายประจำ
          continue;
        } else {
          // กรณีไม่ระบุ ให้ถือว่าเป็นรายเดือนตามพฤติกรรมเดิมแต่ปลอดภัยกว่าคือข้ามหรือคิดเป็นรายเดือน
          monthly += it.amount;
          yearly += it.amount * 12;
        }
      }
      // รายการตามระยะการใช้งาน ไม่ได้มีรอบประจำแบบจำนวนเงินคงที่ในที่นี้ จึงไม่รวมในสรุป
    }
    return { monthlyAvg: monthly, yearlyTotal: yearly };
  }, [items]);

  function getStatus(it: Item) {
    if (it.type === "time" && it.due) {
      const d = new Date(it.due + "T00:00:00");
      const t = new Date(todayStr() + "T00:00:00");
      const diff = Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0) return { label: "เลยกำหนด", cls: "due" };
      if (diff <= 7) return { label: "ใกล้ถึงกำหนด", cls: "warn" };
      return { label: "ปกติ", cls: "" };
    }
    if (it.type === "usage") {
      if (typeof it.current === "number" && typeof it.target === "number") {
        if (it.current >= it.target) return { label: "ถึงกำหนด", cls: "due" };
        if (it.target - it.current <= 1000) return { label: "ใกล้ถึงกำหนด", cls: "warn" };
      }
      return { label: "ปกติ", cls: "" };
    }
    return { label: "ปกติ", cls: "" };
  }

  function openAdd() {
    setEditingId(null);
    setName("");
    setAmount("");
    setType("time");
    setDue(todayStr());
    setRepeat("monthly");
    setCurrent("");
    setInterval("");
    setTarget("");
    setOpen(true);
  }

  function openEdit(it: Item) {
    setEditingId(it.id);
    setName(it.name);
    setAmount(typeof it.amount === "number" ? String(it.amount) : "");
    setType(it.type);
    setDue(it.due || todayStr());
    setRepeat(((it.repeat as any) === "biannual" ? "biyearly" : (it.repeat as any)) || "monthly");
    setCurrent(typeof it.current === "number" ? String(it.current) : "");
    setUnit(it.unit || "กม.");
    setInterval(typeof it.interval === "number" ? String(it.interval) : "");
    setTarget(typeof it.target === "number" ? String(it.target) : "");
    setOpen(true);
  }

  function save() {
    if (editingId) {
      if (type === "time") {
        setItems((prev) =>
          prev.map((it) =>
            it.id === editingId
              ? {
                  ...it,
                  name: name.trim() || "(ไม่มีชื่อ)",
                  amount: amount === "" ? undefined : Number(amount),
                  type: "time",
                  due,
                  repeat: repeat as any,
                }
              : it
          )
        );
      } else {
        setItems((prev) =>
          prev.map((it) =>
            it.id === editingId
              ? {
                  ...it,
                  name: name.trim() || "(ไม่มีชื่อ)",
                  amount: amount === "" ? undefined : Number(amount),
                  type: "usage",
                  current: current === "" ? undefined : Number(current),
                  unit,
                  interval: interval === "" ? undefined : Number(interval),
                  target: target === "" ? undefined : Number(target),
                }
              : it
          )
        );
      }
    } else {
      const id = Math.random().toString(36).slice(2, 9);
      if (type === "time") {
        const it: Item = {
          id,
          name: name.trim() || "(ไม่มีชื่อ)",
          amount: amount === "" ? undefined : Number(amount),
          type: "time",
          due,
          repeat: repeat as any,
        };
        setItems((prev) => [it, ...prev]);
      } else {
        const it: Item = {
          id,
          name: name.trim() || "(ไม่มีชื่อ)",
          amount: amount === "" ? undefined : Number(amount),
          type: "usage",
          current: current === "" ? undefined : Number(current),
          unit,
          interval: interval === "" ? undefined : Number(interval),
          target: target === "" ? undefined : Number(target),
        };
        setItems((prev) => [it, ...prev]);
      }
    }
    setOpen(false);
    setEditingId(null);
    setName("");
    setAmount("");
    setType("time");
    setDue(todayStr());
    setRepeat("monthly");
    setCurrent("");
    setInterval("");
    setTarget("");
  }

  function remove(id: string) {
    if (confirm("ลบรายการนี้?")) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotifPermission("unsupported");
      alert("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        try {
          new Notification("Subscription Tracker", { body: "เปิดใช้งานการแจ้งเตือนแล้ว" });
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      alert("ไม่สามารถขอสิทธิ์การแจ้งเตือนได้");
    }
  }

  function testNotification() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      alert("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน");
      return;
    }
    if (Notification.permission !== "granted") {
      alert("ยังไม่ได้รับอนุญาตการแจ้งเตือน กรุณากด 'ขอสิทธิ์การแจ้งเตือน' ก่อน");
      return;
    }
    try {
      new Notification("Subscription Tracker", { body: "นี่คือการทดสอบการแจ้งเตือน" });
    } catch (e) {
      alert("ไม่สามารถแสดงการแจ้งเตือนได้");
    }
  }

  function moveItem(id: string, direction: -1 | 1) {
    if (sortMode !== "manual") return;
    setItems((prev) => {
      const list = [...prev];
      list.forEach((it, idx) => {
        if (typeof it.sortOrder !== "number") it.sortOrder = idx;
      });
      const arr = list.slice().sort((a,b)=> (typeof a.sortOrder==='number'?a.sortOrder:0) - (typeof b.sortOrder==='number'?b.sortOrder:0));
      const idx = arr.findIndex((it) => it.id === id);
      if (idx < 0) return prev;
      const swap = idx + direction;
      if (swap < 0 || swap >= arr.length) return prev;
      const t = arr[idx].sortOrder;
      arr[idx].sortOrder = arr[swap].sortOrder;
      arr[swap].sortOrder = t;
      // apply back
      const byId = new Map(arr.map((it) => [it.id, it.sortOrder]));
      return list.map((it) => ({ ...it, sortOrder: byId.get(it.id) }));
    });
  }

  function markDone(it: Item) {
    if (it.type === "time") {
      const base = new Date((it.lastDone || it.due || todayStr()) + "T00:00:00");
      let next = it.due || todayStr();
      if (it.repeat === "monthly") next = addMonths(base, 1);
      else if (it.repeat === "yearly") next = addYears(base, 1);
      else if (it.repeat === "biyearly") next = addYears(base, 2);
      else next = todayStr();
      setItems((prev) =>
        prev.map((x) =>
          x.id === it.id
            ? { ...x, due: next, lastDone: todayStr() }
            : x
        )
      );
      return;
    }
    if (it.type === "usage") {
      if (typeof it.target === "number" && typeof it.interval === "number") {
        const current = typeof it.current === "number" ? it.current : it.target - it.interval;
        const nextTarget = current + it.interval;
        setItems((prev) =>
          prev.map((x) =>
            x.id === it.id
              ? { ...x, current: nextTarget, target: nextTarget + (typeof it.interval === "number" ? it.interval : 0), lastDone: todayStr() }
              : x
          )
        );
        return;
      }
      if (typeof it.target === "number") {
        setItems((prev) =>
          prev.map((x) =>
            x.id === it.id
              ? { ...x, current: it.target, lastDone: todayStr() }
              : x
          )
        );
      }
    }
  }

  return (
    <>
      <header>
        <h1>Subscription Tracker</h1>
      </header>

      <section className="summary">
        <div className="summary-item">
          <div className="label">สรุปค่าใช้จ่ายรายเดือน (เฉลี่ย)</div>
          <div className="value">{Math.round(monthlyAvg).toLocaleString("th-TH")} ฿</div>
        </div>
        <div className="summary-item">
          <div className="label">สรุปค่าใช้จ่ายรายปี (เฉลี่ย)</div>
          <div className="value">{Math.round(yearlyTotal).toLocaleString("th-TH")} ฿</div>
        </div>
      </section>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>รายการ</h2>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={sortMode === "auto" ? "" : "ghost"} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setSortMode("auto")}>อัตโนมัติ</button>
          <button className={sortMode === "manual" ? "" : "ghost"} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setSortMode("manual")}>จัดเรียงเอง</button>
        </div>
      </div>
      <section style={{ marginTop: 16, padding: 12, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>การแจ้งเตือน</div>
        <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
          สถานะ: {notifPermission === "unsupported" && "เบราว์เซอร์ไม่รองรับ"}
          {notifPermission === "granted" && "รองรับและอนุญาต"}
          {notifPermission === "default" && "รองรับแต่ยังไม่ได้อนุญาต"}
          {notifPermission === "denied" && "ถูกปฏิเสธ"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {notifPermission !== "unsupported" && notifPermission !== "granted" && (
            <button style={{ padding: "6px 10px", fontSize: 12 }} onClick={requestNotificationPermission}>ขอสิทธิ์การแจ้งเตือน</button>
          )}
          {notifPermission === "granted" && (
            <button className="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={testNotification}>ทดสอบการแจ้งเตือน</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          การแจ้งเตือนจะทำงานได้เฉพาะขณะที่เบราว์เซอร์/แท็บยังเปิดอยู่ ไม่สามารถรับประกันเมื่อปิดเบราว์เซอร์
        </div>
      </section>

      <div className="list">
        {displayItems.map((it) => {
          const st = getStatus(it);
          return (
            <div className="item" key={it.id}>
              <div style={{ flex: 1 }}>
                <div className="title">{it.name}</div>
                <div className="meta">
                  {it.type === "time" && it.due && (
                    <>
                      ครบกำหนด {it.due}
                      {it.repeat === "monthly" && <> • ทุกเดือน</>}
                      {it.repeat === "yearly" && <> • ทุกปี</>}
                      {it.repeat === "biyearly" && <> • ทุก 2 ปี</>}
                      {it.repeat === "none" && <> • ไม่ทำซ้ำ</>}
                    </>
                  )}
                  {it.type === "usage" && typeof it.current === "number" && typeof it.target === "number" && (
                    <>ปัจจุบัน {it.current.toLocaleString("th-TH")} {it.unit} • เป้าหมาย {it.target.toLocaleString("th-TH")} {it.unit}</>
                  )}
                  {typeof it.amount === "number" && <> • {it.amount.toLocaleString("th-TH")} ฿</>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {sortMode === "manual" && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <button className="ghost" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => moveItem(it.id, -1)}>ขึ้น</button>
                    <button className="ghost" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => moveItem(it.id, 1)}>ลง</button>
                  </div>
                )}
                <span className={"badge " + st.cls}>{st.label}</span>
                <button className="ghost" style={{ padding: "6px", display: "flex", alignItems: "center" }} onClick={() => markDone(it)} aria-label="ทำรายการแล้ว">
                  <CheckCircle2 size={16} />
                </button>
                <button className="ghost" style={{ padding: "6px", display: "flex", alignItems: "center" }} onClick={() => openEdit(it)} aria-label="แก้ไข">
                  <Pencil size={16} />
                </button>
                <button className="ghost" style={{ padding: "6px", display: "flex", alignItems: "center", color: "#b91c1c" }} onClick={() => remove(it.id)} aria-label="ลบ">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="fab" onClick={openAdd}>+</button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>{editingId ? "แก้ไขรายการ" : "เพิ่มรายการ"}</h2>
              <button className="ghost" onClick={() => { setOpen(false); setEditingId(null); }} style={{ padding: 6 }}>ปิด</button>
            </div>
            <div style={{ height: 10 }} />
            <div className="row">
              <label>ชื่อรายการ</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Netflix" />
            </div>
            <div className="row">
              <label>จำนวนเงิน (ไม่บังคับ)</label>
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="row">
              <label>ชนิดรายการ</label>
              <select value={type} onChange={(e) => setType(e.target.value as Type)}>
                <option value="time">ตามวันเวลา</option>
                <option value="usage">ตามระยะการใช้งาน</option>
              </select>
            </div>
            {type === "time" && (
              <>
                <div className="row">
                  <label>วันครบกำหนด</label>
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
                <div className="row">
                  <label>รอบการทำซ้ำ</label>
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value as any)}>
                    <option value="none">ไม่ทำซ้ำ</option>
                    <option value="monthly">ทุกเดือน</option>
                    <option value="yearly">ทุกปี</option>
                    <option value="biyearly">ทุก 2 ปี</option>
                  </select>
                </div>
              </>
            )}
            {type === "usage" && (
              <>
                <div className="row">
                  <label>เลขปัจจุบัน</label>
                  <input inputMode="numeric" value={current} onChange={(e) => setCurrent(e.target.value)} />
                </div>
                <div className="row">
                  <label>หน่วย</label>
                  <input value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
                <div className="row">
                  <label>ระยะรอบ (ไม่บังคับ)</label>
                  <input inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value)} placeholder="เช่น 10000" />
                </div>
                <div className="row">
                  <label>ค่าเป้าหมายครั้งถัดไป (ไม่บังคับ)</label>
                  <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
                </div>
              </>
            )}
            <div className="actions">
              <button className="ghost" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button onClick={save}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
