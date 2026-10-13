import { useEffect } from 'react';

// Centralized stack of open modals for back button handling
const modalStack = [];

/**
 * Register a modal's close function.
 * When hardware back or browser back is triggered, the top modal is closed first.
 * @param {Function} closeFn 
 * @returns {Function} unregister function
 */
export const registerModal = (closeFn) => {
  if (typeof closeFn !== 'function') return () => {};
  const modalItem = { id: Math.random().toString(36).substring(2, 9), closeFn };
  modalStack.push(modalItem);

  return () => {
    const idx = modalStack.findIndex((m) => m.id === modalItem.id);
    if (idx !== -1) {
      modalStack.splice(idx, 1);
    }
  };
};

/**
 * Check if there is currently any modal open
 */
export const hasOpenModals = () => modalStack.length > 0;

/**
 * Close the topmost open modal
 * @returns {boolean} true if a modal was found and closed, false otherwise
 */
export const closeTopModal = () => {
  if (modalStack.length > 0) {
    const top = modalStack.pop();
    if (top && typeof top.closeFn === 'function') {
      try {
        top.closeFn();
      } catch (e) {
        console.warn('Error closing modal:', e);
      }
      return true;
    }
  }
  return false;
};

/**
 * React hook to automatically register/unregister modal with back button
 * @param {boolean} isOpen 
 * @param {Function} closeFn 
 */
export const useBackModal = (isOpen, closeFn) => {
  useEffect(() => {
    if (isOpen && typeof closeFn === 'function') {
      const unregister = registerModal(closeFn);
      return () => {
        unregister();
      };
    }
  }, [isOpen, closeFn]);
};
