import { useState, useRef, useEffect } from "react";
import React from "react";
import { FiDollarSign } from "react-icons/fi";
import { FiPlus } from "react-icons/fi";
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://asianloopserver.onrender.com";


const Modal = ({
  fetchOrders,
  isOpen,
  onClose,
  tableName,
  orderItems,
  setOrderItems,
  setTables,
  addOrderItem,
  removeOrderItem,
  dishes,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDishes, setShowDishes] = useState(false); // To control the visibility of the filtered dishes
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [paymentButtonRef, setPaymentButtonRef] = useState(null);
  const [showCustomDishModal, setShowCustomDishModal] = useState(false);
  const modalRef = useRef(null); // Reference for the modal
  const searchWrapperRef = useRef(null); // Reference for the search wrapper
  const [note, setNote] = useState("");
  // Calculate the total

  async function fetchNoteForTable(tableName) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/${tableName}`);
      const data = await res.json();
      return data.note || "";
    } catch (err) {
      console.error("Error fetching note:", err);
      return "";
    }
  }
  useEffect(() => {
    if (!isOpen || !tableName) return;

    async function loadNote() {
      const savedNote = await fetchNoteForTable(tableName);
      setNote(savedNote);
    }

    loadNote();
  }, [isOpen, tableName]);


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

  // Handle search input changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setShowDishes(true); // Show dishes when the user starts typing
  };



  const textareaRef = useRef(null);
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    requestAnimationFrame(() => {
      textarea.style.height = 'auto'; // Reset
      textarea.style.height = `${textarea.scrollHeight}px`; // Apply correct size
    });
  }, [note, isOpen]);

  async function autoUpdateNote(tableName, note) {
    try {
      await fetch(`${API_BASE_URL}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName, note }),
      });
    } catch (error) {
      console.error("Auto update note error:", error);
    }
  }

  useEffect(() => {
    if (!tableName) return;

    const timeout = setTimeout(() => {
      autoUpdateNote(tableName, note);
    }, 500);

    return () => clearTimeout(timeout);
  }, [note, tableName]);


  const createBillAndRemoveChecked = async (tableName, method) => {
    // Step 1: Gather checked items
    const checkedList = orderItems
      .filter((_, index) => checkedItems[index])
      .map(item => ({
        name: item.name,
        price: item.price
      }));

    if (checkedList.length === 0) return; // Nothing selected

    // Step 2: Calculate total price
    const billTotal = checkedList.reduce((sum, item) => sum + Number(item.price), 0);

    // Step 3: Create bill object
    const newBill = {
      table: tableName,
      items: checkedList,
      total: billTotal,
      method: method,
      date: new Date().toISOString(),
    };

    // Step 4: Save bill to localStorage (append to history)
    const existingBills = JSON.parse(localStorage.getItem("bills")) || [];
    existingBills.push(newBill);
    localStorage.setItem("bills", JSON.stringify(existingBills));

    console.log("Bill Saved locally:", newBill);

    // Sync new bill to server
    try {
      await fetch(`${API_BASE_URL}/api/bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBill),
      });
      console.log("Bill synced to server successfully");
    } catch (err) {
      console.warn("Failed to sync bill to server:", err);
    }

    // Step 5: Remove checked items from orderItems
    const updatedOrderItems = orderItems.filter((_, index) => !checkedItems[index]);
    setOrderItems(updatedOrderItems);

    const saved = JSON.parse(localStorage.getItem("orders")) || {};
    const updatedAllOrders = {
      ...saved,
      [tableName]: updatedOrderItems,
    };
    localStorage.setItem("orders", JSON.stringify(updatedAllOrders));
    // 4️⃣ Now sync updated orders to server
    const payload = {
      table: tableName,
      orders: updatedOrderItems,
    };

    // Helper: fetch with timeout
    const fetchWithTimeout = (url, options, timeout = 7000) =>
      Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeout)
        ),
      ]);

    // Retry mechanism
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;

    while (!success && attempts < maxAttempts) {
      attempts++;

      try {
        const res = await fetchWithTimeout(
          `${API_BASE_URL}/api/orders`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data = await res.json();
        console.log(`✅ Synced table ${tableName} to DB:`, data);
        success = true;

      } catch (err) {
        console.warn(`⚠️ Attempt ${attempts} failed:`, err.message);
      }
    }
    // Step 6: Clear checked state
    setCheckedItems({});
    setShowPaymentSelection(false);
  };

  const selectAllAndPay = (e) => {
    const allChecked = {};
    orderItems.forEach((_, i) => {
      allChecked[i] = true;
    });
    setCheckedItems(allChecked);
    if (e && e.currentTarget) {
      setPaymentButtonRef(e.currentTarget);
    }
    setShowPaymentSelection(true);
  };

  return (
    isOpen && (
      <div className="text-xl fixed inset-0 bg-gray-400 bg-opacity-50 flex justify-center items-center z-50">
        <div
          ref={modalRef}
          className="bg-white p-6 rounded-lg w-full h-full sm:max-w-md sm:max-h-screen overflow-y-auto relative"
        >
          {/* Close button (X) */}
          <button
            onClick={() => {
              setShowPaymentSelection(false);
              onClose();
            }}
            className="absolute mt-12 top-2 right-2 text-2xl font-bold text-white bg-black hover:text-gray-700"
          >
            X
          </button>

          <h2 className="text-3xl font-bold mb-4 mt-10">Tisch {tableName}</h2>

          {/* Custom Item Button + Search Bar */}
          <div className="mb-4 flex gap-2 items-center" ref={searchWrapperRef}>
            <button
              onClick={() => setShowCustomDishModal(true)}
              className="text-black bg-gray-200 hover:bg-gray-300 w-10 h-10 rounded shadow flex items-center justify-center text-3xl font-bold transition-colors leading-none pb-1 shrink-0"
              title="Custom Diverse Speisen"
            >
              +
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search for a dish..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full p-2 border border-gray-300 rounded"
              />

              {/* Display filtered dishes only if showDishes is true */}
              {showDishes && searchQuery && filteredDishes.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded z-20 shadow-lg">
                  {filteredDishes.slice(0, 8).map((dish, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 cursor-pointer hover:bg-gray-200"
                      onClick={() => {
                        addOrderItem(dish.name, dish.price); // Add the item to the order
                        setShowDishes(false); // Close the dropdown
                        setSearchQuery(""); // Clear the search query
                      }}
                    >
                      <span>{dish.name}</span>
                      <span>{dish.price}€</span>
                    </div>
                  ))}
                </div>
              )}

              {/* If no dishes match the search query, display a "No results" message */}
              {showDishes && searchQuery && filteredDishes.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 p-2 text-center text-gray-500 bg-white border border-gray-300 rounded z-20 shadow-lg">
                  No results found
                </div>
              )}
            </div>
          </div>

          {/* Note Box */}
          <div>
            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={1}
              className="w-full flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 resize-none overflow-hidden"
              placeholder="Write your note here..."
            />
          </div>

          {/* Order Items */}
          <div className="mt-2 p-1 border border-gray-300 rounded-lg shadow-lg bg-white">
            {orderItems.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center px-2 py-1 border-b last:border-0 hover:bg-gray-100"
              >
                {/* Left: Checkbox + Item name */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={!!checkedItems[index]}
                    onChange={() => toggleChecked(index)}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold text-xl">{item.name}</span>
                </div>

                {/* Right: Price + Remove button */}
                <div className="flex items-center space-x-0">
                  <span className="text-xl text-black mr-1 ">{item.price}€</span>
                  <span
                    onClick={() => {
                      // Remove the checkbox state too
                      setCheckedItems(prev => {
                        const updated = { ...prev };
                        delete updated[index];   // delete this checkbox value
                        return updated;
                      });

                      removeOrderItem(index);
                    }}
                    className="text-gray-700 text-xl p-0 leading-none cursor-pointer"
                    style={{ background: 'none', border: 'none' }}
                  >
                    ✕
                  </span>
                </div>
              </div>
            ))}



          </div>
          {/* Total price of checked items */}
          <div className="flex justify-end items-center mt-3 gap-4">
            {totalPrice > 0 && (
              <div className="font-bold text-2xl text-green-700">
                Getrennt: {totalPrice.toFixed(2)}€
              </div>
            )}
            {Object.values(checkedItems).some(value => value) && (
              <button
                ref={setPaymentButtonRef}
                onClick={(e) => {
                  setPaymentButtonRef(e.currentTarget);
                  setShowPaymentSelection(true);
                }}
                className="bg-green-600 hover:bg-green-800 text-white p-2 rounded-md shadow flex items-center justify-center transition-colors"
                title="Bezahlen"
              >
                <FiDollarSign size={15} />
              </button>
            )}


          </div>

          {showCustomDishModal && (
            <div className="absolute inset-0 bg-white/95 flex flex-col justify-center items-center z-50 rounded-lg p-6">
              <h3 className="text-3xl font-bold mb-4 text-gray-800">Diverse Speisen</h3>
              <p className="text-lg text-gray-600 mb-6">Preis manuell eingeben:</p>

              <input
                type="number"
                placeholder="Preis (€)"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full max-w-sm p-4 border border-gray-300 rounded-lg text-2xl text-center mb-6 focus:outline-none focus:border-blue-500"
                step="0.01"
                autoFocus
              />

              <div className="flex gap-4">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-lg text-xl shadow-lg transition-transform hover:scale-105"
                  onClick={() => {
                    if (customPrice && !isNaN(customPrice) && Number(customPrice) > 0) {
                      addOrderItem("Diverse Speisen", parseFloat(customPrice));
                      setCustomPrice("");
                      setShowCustomDishModal(false);
                    }
                  }}
                >
                  + Einfügen
                </button>
                <button
                  className="bg-gray-400 hover:bg-gray-500 text-white font-bold px-8 py-3 rounded-lg text-xl shadow transition-colors"
                  onClick={() => {
                    setCustomPrice("");
                    setShowCustomDishModal(false);
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {showPaymentSelection && paymentButtonRef && (
            <div 
              className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 z-50 w-72"
              style={{
                top: `${paymentButtonRef.getBoundingClientRect().top - 50}px`,
                right: `${window.innerWidth - paymentButtonRef.getBoundingClientRect().right + 10}px`,
              }}
            >
              <button
                onClick={() => setShowPaymentSelection(false)}
                className="absolute top-2 right-2 text-xl font-bold text-gray-600 hover:text-gray-800"
              >
                X
              </button>
              <div className="text-center font-bold text-lg mb-4">
                Total: {totalPrice.toFixed(2)}€
              </div>
              <div className="flex flex-row gap-3 justify-center">
                <button
                  className="bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3 rounded-lg text-lg shadow-lg transition-transform hover:scale-105"
                  onClick={() => createBillAndRemoveChecked(tableName, "Bar")}
                >
                  💵 Bar
                </button>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-3 rounded-lg text-lg shadow-lg transition-transform hover:scale-105"
                  onClick={() => createBillAndRemoveChecked(tableName, "Karte")}
                >
                  💳 Karte
                </button>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="mt-4 font-bold bg-blue-300 w-full rounded-lg p-3 flex justify-between items-center">
            <div>
              Insgesamt:<span className="text-2xl ml-4 relative top-0.5">{calculateTotal()}€</span>
            </div>
            {orderItems && orderItems.length > 0 && (
              <button
                onClick={selectAllAndPay}
                className="bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-lg shadow font-semibold flex items-center gap-2 transition-colors text-lg"
              >
                <FiDollarSign size={15} />
              </button>
            )}
          </div>


        </div>
      </div>
    )
  );
};

export default Modal;
