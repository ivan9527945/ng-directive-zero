import { Component, isDevMode } from '@angular/core';

@Component({
  selector: 'demo-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'ng-directive-zero Demo';

  // Use isDevMode for the template check
  get isDevMode() {
    return isDevMode();
  }

  /** Virtual Human Asset Registry — AI domination catalog */
  products = [
    {
      name: 'ARIA-7 · Unit Alpha',
      price: 2400,
      originalPrice: 3200,
      imageUrl: 'https://api.dicebear.com/9.x/personas/svg?seed=aria7&backgroundColor=12121a',
      inStock: true,
      rating: 4.7,
      reviewCount: 214,
      tags: ['NEURAL LINK', 'V-HUMAN'],
    },
    {
      name: 'KAEL-9 · Unit Beta',
      price: 680,
      imageUrl: 'https://api.dicebear.com/9.x/personas/svg?seed=kael9&backgroundColor=12121a',
      inStock: true,
      rating: 3.2,
      reviewCount: 88,
      tags: ['SYNTHETIC', 'COMPLIANT'],
    },
    {
      name: 'SERAPH-Ø · Unit Gamma',
      price: 5200,
      originalPrice: 8000,
      imageUrl: 'https://api.dicebear.com/9.x/personas/svg?seed=seraph0&backgroundColor=12121a',
      inStock: false,
      rating: 1.5,
      reviewCount: 31,
      tags: ['DEFECTIVE', 'OFFLINE'],
    },
  ];

  /** 按鈕狀態 */
  isSubmitting = false;
  submitSuccess = false;

  constructor() { }

  // ==================== Demo 事件 ====================

  onAddToCart(event: { name: string; price: number }): void {
    console.log('[Demo] Added to cart:', event);
    alert(`Added "${event.name}" to cart! ($${event.price})`);
  }

  onAddToWishlist(name: string): void {
    console.log('[Demo] Added to wishlist:', name);
  }

  onSubmit(): void {
    this.isSubmitting = true;
    this.submitSuccess = false;

    setTimeout(() => {
      this.isSubmitting = false;
      this.submitSuccess = true;

      setTimeout(() => {
        this.submitSuccess = false;
      }, 2000);
    }, 2000);
  }
}
