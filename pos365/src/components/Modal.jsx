import { useState, useRef, useEffect } from "react";
import React from "react";
import { FiDollarSign } from "react-icons/fi";
import { FiPlus } from "react-icons/fi";
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://asianloopserver.onrender.com";


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
  const [paymentButtonRef, setPaymentButtonRef] = useState(null);
  const [showCustomDishModal, setShowCustomDishModal] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const modalRef = useRef(null); // Reference for the modal
  const searchWrapperRef = useRef(null); // Reference for the search wrapper
  const pressTimerRef = useRef(null);
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

  // Handle search input changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setShowDishes(true); // Show dishes when the user starts typing
  };


  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  const clearLongPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const startLongPress = (index) => {
    clearLongPress();
    pressTimerRef.current = setTimeout(() => {
      setEditingNoteIndex(index);
      setItemNote(orderItems[index]?.note || "");
    }, 1000);
  };

  const closeItemNoteEditor = () => {
    setEditingNoteIndex(null);
    setItemNote("");
    clearLongPress();
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
    // Step 1: Gather checked items
    const checkedList = orderItems
      .filter((_, index) => checkedItems[index])
      .map(item => ({
        name: item.name,
        price: Number(item.price),
      }));

    if (checkedList.length === 0) return; // Nothing selected

    // Step 2: Calculate total price
    const billTotal = checkedList.reduce((sum, item) => sum + item.price, 0);

    // Step 3: Create bill object
    const newBill = {
      table: tableName,
      items: checkedList,
      total: billTotal,
      method,
      date: new Date().toISOString(),
    };

    // Helper: fetch with timeout
    const fetchWithTimeout = (url, options, timeout = 7000) =>
      Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeout)
        ),
      ]);

    const postJsonWithRetry = async (url, payload, maxAttempts = 3) => {
      let lastError;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.error || `Server error: ${response.status}`);
          }

          return response.json();
        } catch (error) {
          lastError = error;
          console.warn(`⚠️ Attempt ${attempt} to POST ${url} failed:`, error.message);
          if (attempt === maxAttempts) break;
        }
      }
      throw lastError;
    };

    let savedBill;
    try {
      savedBill = await postJsonWithRetry(`${API_BASE_URL}/api/bills`, newBill);
      console.log("Bill synced to server successfully", savedBill);
    } catch (err) {
      console.error("Failed to save bill to server:", err);
      alert('Không thể lưu bill vào database. Vui lòng refresh lại trang.');
      window.location.reload();
      return;
    }

    // Save bill locally only after successful DB persistence
    const existingBills = JSON.parse(localStorage.getItem("bills")) || [];
    existingBills.push(savedBill);
    localStorage.setItem("bills", JSON.stringify(existingBills));

    // Step 4: Remove checked items from orderItems
    const updatedOrderItems = orderItems.filter((_, index) => !checkedItems[index]);
    setOrderItems(updatedOrderItems);

    const saved = JSON.parse(localStorage.getItem("orders")) || {};
    const updatedAllOrders = {
      ...saved,
      [tableName]: updatedOrderItems,
    };
    localStorage.setItem("orders", JSON.stringify(updatedAllOrders));

    const payload = {
      table: tableName,
      orders: updatedOrderItems,
    };

    try {
      await postJsonWithRetry(`${API_BASE_URL}/api/orders`, payload);
      console.log(`✅ Synced table ${tableName} orders to DB`);
    } catch (err) {
      console.error("Failed to sync updated orders to server:", err);
      alert('Bill đã lưu, nhưng cập nhật đơn hàng thất bại. Vui lòng refresh lại trang.');
      window.location.reload();
      return;
    }

    // Step 5: Clear checked state and close payment UI
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
          className="bg-white p-6 rounded-lg w-full h-full sm:max-w-md sm:max-h-screen overflow-y-auto relative select-none"
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
                className="w-full p-2 border border-gray-300 rounded select-text"
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

          {/* Order Items */}
          <div className="mt-2 p-1 border border-gray-300 rounded-lg shadow-lg bg-white">
            {orderItems.map((item, index) => (
              <React.Fragment key={index}>
                <div
                  onPointerDown={() => startLongPress(index)}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onContextMenu={(e) => e.preventDefault()}
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
                  <div>
                    <span className="font-semibold text-xl">{item.name}</span>
                    {item.note && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.note}</p>
                    )}
                  </div>
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
                {editingNoteIndex === index && (
                  <div className="px-2 py-2 bg-blue-50 border-b last:border-0">
                  <textarea
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    rows={2}
                    autoFocus
                    className="w-full p-2 border border-blue-300 rounded-md resize-y select-text focus:outline-none focus:border-blue-500"
                    placeholder="Ghi chú cho món ăn..."
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={closeItemNoteEditor}
                      className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={saveItemNote}
                      className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Lưu ghi chú
                    </button>
                  </div>
                  </div>
                )}
              </React.Fragment>
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
                className="w-full max-w-sm p-4 border border-gray-300 rounded-lg text-2xl text-center mb-6 focus:outline-none focus:border-blue-500 select-text"
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
