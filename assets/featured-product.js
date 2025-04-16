class FeaturedProduct extends HTMLElement {
  constructor() {
    super();
    this.optionButtons = this.querySelectorAll('.option-button');
    this.productHandle = this.dataset.productHandle;
    this.sectionId = this.dataset.sectionId;
    this.variantData = null;
    this.selectedOptions = [];
    this.init();
  }

  async init() {
    const url = `/products/${this.productHandle}?section_id=${this.sectionId}`;
    const response = await fetch(url);
    const html = await response.text();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const productEl = tempDiv.querySelector('featured-product');
    const scriptTag = productEl.querySelector('script[type="application/json"]');

    if (scriptTag) {
      this.variantData = JSON.parse(scriptTag.innerHTML);
    }

    this.registerEvents();
    this.showInitialMedia(); // Show first image on load
  }

  registerEvents() {
    this.optionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const optionIndex = button.dataset.optionIndex;
        const value = button.dataset.value;

        this.updateSelectedOption(optionIndex, value);
        this.updateVariant();
        const sizeActive = this.querySelector('.product-option[data-option-index="0"] .option-button.active');
        const colorActive = this.querySelector('.product-option[data-option-index="1"] .option-button.colorval.active');

        if (sizeActive && colorActive) {
          this.querySelector('.error-messages').innerHTML = '';
        }
      });
    });

    // Quantity buttons
    this.querySelector('[data-action="increment"]').addEventListener('click', () => {
      const quantityInput = this.querySelector('.quantity-input');
      quantityInput.value = parseInt(quantityInput.value) + 1;
      this.updateVariant(); // Update price and media based on new quantity
    });

    this.querySelector('[data-action="decrement"]').addEventListener('click', () => {
      const quantityInput = this.querySelector('.quantity-input');
      if (parseInt(quantityInput.value) > 1) {
        quantityInput.value = parseInt(quantityInput.value) - 1;
        this.updateVariant(); // Update price and media based on new quantity
      }
    });

    // Add to cart
    this.querySelector('.add-to-cart-button').addEventListener('click', () => {
      this.addToCart();
    });

    // Thumbnail gallery
    this.querySelectorAll('.media-thumbnail').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const mediaId = thumb.dataset.mediaId;
        this.updateMedia(mediaId);
      });
    });
  }

  updateSelectedOption(index, value) {
    const buttons = this.querySelectorAll(`.option-button[data-option-index="${index}"]`);
    buttons.forEach((btn) => btn.classList.remove('active'));

    this.querySelector(
      `.option-button[data-option-index="${index}"][data-value="${value}"]`
    )?.classList.add('active');

    this.selectedOptions[index] = value;
  }

  updateVariant() {
    if (!this.variantData) return;

    const matchingVariant = this.variantData.variants.find((variant) => {
      return variant.options.every((val, idx) => val === this.selectedOptions[idx]);
    });

    if (matchingVariant) {
      if (matchingVariant.featured_media?.id) {
        this.updateMedia(matchingVariant.featured_media.id);
      }
      this.updatePrice(matchingVariant.price, matchingVariant.compare_at_price);
    }
  }

  updatePrice(price, comparePrice) {
    const priceElement = this.querySelector('.regular-price');
    const compareElement = this.querySelector('.compare-price');

    // Check if Shopify.formatMoney exists
    if (typeof Shopify.formatMoney === 'function') {
      priceElement.textContent = Shopify.formatMoney(price, Shopify.money_format);

      if (compareElement && comparePrice > price) {
        compareElement.textContent = Shopify.formatMoney(comparePrice, Shopify.money_format);
        compareElement.style.display = 'inline';
      } else if (compareElement) {
        compareElement.style.display = 'none';
      }
    } else {
      // Fallback to a basic formatting function
      priceElement.textContent = this.formatPrice(price);

      if (compareElement && comparePrice > price) {
        compareElement.textContent = this.formatPrice(comparePrice);
        compareElement.style.display = 'inline';
      } else if (compareElement) {
        compareElement.style.display = 'none';
      }
    }
  }

  formatPrice(price) {
    return '$ ' + (price / 100).toFixed(2); // Basic formatting for USD
  }

  updateMedia(mediaId) {
    const allMedia = this.querySelectorAll('.media-item');
    allMedia.forEach((media) => (media.style.display = 'none'));

    const matched = this.querySelector(`.media-item[data-media-id="${mediaId}"]`);
    if (matched) {
      matched.style.display = 'block';
    }
  }

  showInitialMedia() {
    const firstMedia = this.querySelector('.media-item');
    if (firstMedia) {
      firstMedia.style.display = 'block';
    }
  }

  addToCart() {
    const variantId = this.getSelectedVariantId();
    const quantity = parseInt(this.querySelector('.quantity-input').value);

    if (!variantId) {
      this.showErrorMessage('Please select all options.');
      return;
    }

    fetch('/cart/add.js', {
      method: 'POST',
      body: JSON.stringify({ items: [{ id: variantId, quantity }] }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Add to cart failed.');
        return res.json();
      })
      .then(() => {
        openCartDrawer(); // Open the cart drawer after item is added
        this.updateCartSections(); // Update the cart icon bubble and cart items
      })
      .catch(() => this.showErrorMessage('Error adding to cart.'));
  }

  getSelectedVariantId() {
    const matchingVariant = this.variantData.variants.find((variant) => {
      return variant.options.every((val, idx) => val === this.selectedOptions[idx]);
    });
    return matchingVariant ? matchingVariant.id : null;
  }

  showErrorMessage(message) {
    const errorContainer = this.querySelector('.error-messages');
    errorContainer.innerHTML = `<p style="color:red;">${message}</p>`;
  }

  updateCartSections() {
    // Fetch updated cart content for the cart icon bubble and drawer
    fetch('/?sections=cart-icon-bubble,custom-cart-drawer')
      .then((res) => res.json())
      .then((data) => {
        // Update the cart icon bubble
        const newCartBubble = document.createElement('div');
        newCartBubble.innerHTML = data['cart-icon-bubble'];
        const oldCartBubble = document.querySelector('#cart-icon-bubble');
        oldCartBubble.replaceWith(newCartBubble.querySelector('#cart-icon-bubble'));

        // Update the cart drawer
        const newCartDrawer = document.createElement('div');
        newCartDrawer.innerHTML = data['custom-cart-drawer'];
        const oldCartDrawer = document.querySelector('#cart-drawer');
        oldCartDrawer.replaceWith(newCartDrawer.querySelector('#cart-drawer'));
      })
      .catch((error) => {
        console.error('Error updating cart sections:', error);
      });
  }
}

customElements.define('featured-product', FeaturedProduct);
