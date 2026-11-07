import { useState, useRef, useEffect } from "react";
import React from "react";
import { FiDollarSign, FiEye, FiEyeOff, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://asianloopserver.onrender.com";

const drinkPattern = /tee|kaffee|espresso|cappuccino|wasser|cola|saft|bier|wein|sake|limonade|spritz|mojito|cocktail|drink|fanta|sprite|schorle|prosecco|smoothie|tonic/;
const ignoredSimilarityTokens = new Set(["mit", "und", "oder", "fur", "zum", "zur"]);

const getItemTokens = (name) => {
  const normalizedName = String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[~°\s]*\d+[a-z]?[.)\s-]*/, "")
    .replace(/^[~°\s]+/, "");

  return new Set(
    (normalizedName.match(/[a-z0-9]+/g) || [])
      .filter((token) => !ignoredSimilarityTokens.has(token))
  );
};

const sortSimilarItems = (items) => {
  const entries = items.map((item, originalIndex) => ({
    item,
    originalIndex,
    tokens: getItemTokens(item.name),
    isDrink: String(item.name).trim().startsWith("~") || drinkPattern.test(
      String(item.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    ),
  }));

  const sortGroup = (group) => {
    const remaining = [...group];
    const sorted = [];
    if (remaining.length === 0) return sorted;
    sorted.push(remaining.shift());

    while (remaining.length > 0) {
      const previousTokens = sorted[sorted.length - 1].tokens;
      let bestIndex = 0;
      let bestScore = -1;

      remaining.forEach((candidate, index) => {
        const intersectionSize = [...candidate.tokens].filter((token) => previousTokens.has(token)).length;
        const unionSize = new Set([...candidate.tokens, ...previousTokens]).size;
        const score = unionSize === 0 ? 0 : intersectionSize / unionSize;
        if (score > bestScore || (score === bestScore && candidate.originalIndex < remaining[bestIndex].originalIndex)) {
          bestIndex = index;
          bestScore = score;
        }
      });

      sorted.push(remaining.splice(bestIndex, 1)[0]);
    }

    return sorted;
  };

  return [
    ...sortGroup(entries.filter((entry) => entry.isDrink)),
    ...sortGroup(entries.filter((entry) => !entry.isDrink)),
  ];
};

const postJsonWithRetry = async (url, payload, maxAttempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Server error: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const readBills = () => {
  try {
    return JSON.parse(localStorage.getItem("bills") || "[]");
  } catch {
    return [];
  }
};

const syncPendingBills = async () => {
  const pendingBills = readBills().filter((bill) => bill.syncStatus === "pending");
  for (const bill of pendingBills) {
    try {
      const savedBill = await postJsonWithRetry(`${API_BASE_URL}/api/bills`, bill);
      const currentBills = readBills();
      localStorage.setItem("bills", JSON.stringify(currentBills.map((current) =>
        current.clientId === bill.clientId ? { ...savedBill, syncStatus: "synced" } : current
      )));
    } catch (error) {
      console.warn("Bill sync is pending:", error.message);
    }
  }
};

const Modal = ({
  isOpen,
  onClose,
  tableName,
  orderItems,
  setOrderItems,
  addOrderItem,
  removeOrderItem,
  dishes,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDishes, setShowDishes] = useState(false); // To control the visibility of the filtered dishes
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [itemNote, setItemNote] = useState("");
  const [showCustomDishModal, setShowCustomDishModal] = useState(false);
  const [sortSimilar, setSortSimilar] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [isSavingBill, setIsSavingBill] = useState(false);
  const savingBillRef = useRef(false);
  const lastItemTapRef = useRef({ index: -1, time: 0 });
  const modalRef = useRef(null); // Reference for the modal
  const searchWrapperRef = useRef(null); // Reference for the search wrapper

  useEffect(() => {
    syncPendingBills();
    const interval = window.setInterval(syncPendingBills, 15000);
    window.addEventListener("online", syncPendingBills);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", syncPendingBills);
    };
  }, []);
  // Calculate the total


  const calculateTotal = () => {
    let total = 0;

    if (Array.isArray(orderItems)) {
      orderItems.forEach((item) => {
        total += parseFloat(item.price);
      });
    }

    return total.toFixed(2); // Returns a string like "20.00"
  };

  const [checkedItems, setCheckedItems] = useState({});
  const toggleChecked = (index) => {
    setCheckedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  let totalPrice = 0;

  if (Array.isArray(orderItems)) {
    orderItems.forEach((item, index) => {
      if (checkedItems[index]) {
        totalPrice += parseFloat(item.price);
      }
    });
  }


  // Filter dishes based on the search query
  const filteredDishes = dishes.filter((dish) =>
    dish.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const displayedOrderItems = sortSimilar
    ? sortSimilarItems(orderItems)
    : orderItems.map((item, originalIndex) => ({ item, originalIndex }));

  // Handle search input changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setShowDishes(true); // Show dishes when the user starts typing
  };


  const openItemNoteEditor = (index) => {
    setEditingNoteIndex(index);
    setItemNote(orderItems[index]?.note || "");
  };

  const handleItemTap = (index) => {
    const now = Date.now();
    const lastTap = lastItemTapRef.current;
    if (lastTap.index === index && now - lastTap.time <= 500) {
      lastItemTapRef.current = { index: -1, time: 0 };
      openItemNoteEditor(index);
      return;
    }
    lastItemTapRef.current = { index, time: now };
  };

  const closeItemNoteEditor = () => {
    setEditingNoteIndex(null);
    setItemNote("");
  };

  const saveItemNote = () => {
    if (editingNoteIndex === null) return;

    const updatedOrderItems = orderItems.map((item, index) => (
      index === editingNoteIndex ? { ...item, note: itemNote } : item
    ));
    setOrderItems(updatedOrderItems);
    closeItemNoteEditor();
  };

  const createBillAndRemoveChecked = async (tableName, method) => {
    if (savingBillRef.current) return;
    // Step 1: Gather checked items
    const checkedList = orderItems
      .filter((_, index) => checkedItems[index])
      .map(item => ({
        name: item.name,
        price: Number(item.price),
      }));

    if (checkedList.length === 0) return; // Nothing selected

    savingBillRef.current = true;
    setIsSavingBill(true);

    // Step 2: Calculate total price
    const billTotal = checkedList.reduce((sum, item) => sum + item.price, 0);

    // Step 3: Create bill object
    const newBill = {
      clientId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      table: tableName,
      items: checkedList,
      total: billTotal,
      method,
      date: new Date().toISOString(),
    };

    const existingBills = readBills();
    localStorage.setItem("bills", JSON.stringify([...existingBills, { ...newBill, syncStatus: "pending" }]));

    try {
      const savedBill = await postJsonWithRetry(`${API_BASE_URL}/api/bills`, newBill);
      const currentBills = readBills();
      localStorage.setItem("bills", JSON.stringify(currentBills.map((bill) =>
        bill.clientId === newBill.clientId ? { ...savedBill, syncStatus: "synced" } : bill
      )));
    } catch (err) {
      console.error("Failed to save bill to server:", err);
    }

    // Step 4: Remove checked items from orderItems
    const updatedOrderItems = orderItems.filter((_, index) => !checkedItems[index]);
    setOrderItems(updatedOrderItems);

    const saved = JSON.parse(localStorage.getItem("orders")) || {};
    const updatedAllOrders = {
      ...saved,
      [tableName]: updatedOrderItems,
    };
    localStorage.setItem("orders", JSON.stringify(updatedAllOrders));

    try {
      const synced = await setOrderItems(updatedOrderItems);
      if (!synced) {
        console.warn("Bill saved; table update will sync when a connection is available.");
      }
    } catch (err) {
      console.error("Failed to sync updated orders to server:", err);
    }

    // Step 5: Clear checked state and close payment UI
    setCheckedItems({});
    setShowPaymentSelection(false);
    savingBillRef.current = false;
    setIsSavingBill(false);
  };

  const selectAllAndPay = () => {
    const allChecked = {};
    orderItems.forEach((_, i) => {
      allChecked[i] = true;
    });
    setCheckedItems(allChecked);
    setShowPaymentSelection(true);
  };

  return (
    isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm sm:p-5">
        <div
          ref={modalRef}
          className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white text-slate-900 shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
        >
          {isSavingBill && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-slate-950/60 text-white" role="status" aria-live="polite">
              <span className="h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              <span className="text-base font-medium">Zahlung wird gespeichert...</span>
            </div>
          )}
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bestellung</p>
              <h2 className="mt-1 text-xl font-semibold">Tisch {tableName}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPaymentSelection(false);
                onClose();
              }}
              className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tisch schließen"
            >
              <FiX size={20} />
            </button>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="mb-4 flex gap-2" ref={searchWrapperRef}>
              <button
                type="button"
                onClick={() => setShowCustomDishModal(true)}
                className="flex shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                style={{ width: "44px", height: "44px", padding: 0, borderRadius: "8px" }}
                title="Eigene Speise hinzufügen"
                aria-label="Eigene Speise hinzufügen"
              >
                <FiPlus size={23} strokeWidth={2.5} />
              </button>
              <div className="relative min-w-0 flex-1">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="text"
                  placeholder="Speise suchen"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
                {showDishes && searchQuery && filteredDishes.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    {filteredDishes.slice(0, 8).map((dish, index) => (
                      <button
                        key={`${dish.name}-${index}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
                        onClick={() => {
                          addOrderItem(dish.name, dish.price);
                          setShowDishes(false);
                          setSearchQuery("");
                        }}
                      >
                        <span className="truncate">{dish.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-500">{dish.price}€</span>
                      </button>
                    ))}
                  </div>
                )}
                {showDishes && searchQuery && filteredDishes.length === 0 && (
                  <p className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-500 shadow-lg">
                    Keine Treffer
                  </p>
                )}
              </div>
            </div>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Artikel</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{orderItems.length}</span>
                  <button
                    type="button"
                    onClick={() => setSortSimilar((current) => !current)}
                    className={`rounded-md border p-2 transition-colors ${sortSimilar ? "border-slate-400 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                    title={sortSimilar ? "Ursprüngliche Reihenfolge anzeigen" : "Ähnliche Artikel gruppieren"}
                    aria-label={sortSimilar ? "Ursprüngliche Reihenfolge anzeigen" : "Ähnliche Artikel gruppieren"}
                    aria-pressed={sortSimilar}
                  >
                    {sortSimilar ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                  </button>
                </div>
              </div>
              {orderItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  Noch keine Artikel
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border-y border-slate-200">
                  {displayedOrderItems.map(({ item, originalIndex }) => (
                    <React.Fragment key={`${item.name}-${originalIndex}`}>
                      <div
                        onClick={() => handleItemTap(originalIndex)}
                        className="flex items-center gap-3 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedItems[originalIndex]}
                          onChange={() => toggleChecked(originalIndex)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 shrink-0 accent-emerald-700"
                          aria-label={`${item.name} für Zahlung auswählen`}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-medium text-slate-800">{item.name}</span>
                          {item.note && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{item.note}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums">{Number(item.price).toFixed(2)}€</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCheckedItems((prev) => {
                              const updated = { ...prev };
                              delete updated[originalIndex];
                              return updated;
                            });
                            removeOrderItem(originalIndex);
                          }}
                          className="rounded-md p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                          aria-label={`${item.name} entfernen`}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                      {editingNoteIndex === originalIndex && (
                        <div className="pb-3">
                          <textarea
                            value={itemNote}
                            onChange={(e) => setItemNote(e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            rows={2}
                            autoFocus
                            className="w-full resize-y rounded-md border border-slate-200 p-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Notiz zum Artikel"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button type="button" onClick={closeItemNoteEditor} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Abbrechen</button>
                            <button type="button" onClick={saveItemNote} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">Speichern</button>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </section>

          </main>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
            {Object.values(checkedItems).some(Boolean) && (
              <div className="mb-3 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2.5">
                <span className="text-sm text-emerald-900">Ausgewählt</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-emerald-900">{totalPrice.toFixed(2)}€</span>
                  <button
                    type="button"
                    onClick={() => setShowPaymentSelection(true)}
                    className="rounded-md bg-emerald-700 p-2 text-white transition-colors hover:bg-emerald-800"
                    aria-label="Ausgewählte Artikel bezahlen"
                  >
                    <FiDollarSign size={17} />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">Gesamt</p>
                <p className="text-xl font-semibold tabular-nums text-slate-900">{calculateTotal()}€</p>
              </div>
              {orderItems.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllAndPay}
                  className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                >
                  <FiDollarSign size={17} />
                  Alles bezahlen
                </button>
              )}
            </div>
          </footer>

          {showCustomDishModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Eigene Speise</h3>
                  <button type="button" onClick={() => setShowCustomDishModal(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Schließen">
                    <FiX size={18} />
                  </button>
                </div>
                <label className="mb-4 block text-sm text-slate-600">
                  Preis
                  <div className="relative mt-1.5">
                    <input
                      type="number"
                      placeholder="0,00"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="w-full rounded-md border border-slate-200 py-2.5 pl-3 pr-9 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      step="0.01"
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                  </div>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPrice("");
                      setShowCustomDishModal(false);
                    }}
                    className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={!customPrice || Number(customPrice) <= 0}
                    onClick={() => {
                      addOrderItem("Diverse Speisen", parseFloat(customPrice));
                      setCustomPrice("");
                      setShowCustomDishModal(false);
                    }}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPaymentSelection && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Zahlungsart</h3>
                  <button type="button" onClick={() => setShowPaymentSelection(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Schließen">
                    <FiX size={18} />
                  </button>
                </div>
                <p className="mb-4 text-sm text-slate-500">Betrag <span className="float-right font-semibold tabular-nums text-slate-900">{totalPrice.toFixed(2)}€</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSavingBill}
                    className="rounded-md bg-emerald-700 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
                    onClick={() => createBillAndRemoveChecked(tableName, "Bar")}
                  >
                    Bar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingBill}
                    className="rounded-md bg-slate-900 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                    onClick={() => createBillAndRemoveChecked(tableName, "Karte")}
                  >
                    Karte
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  );
};

export default Modal;
