import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * ProductCardComponent
 *
 * 示範組件：展示多個 @Input 和 @Output 的產品卡片
 */
@Component({
    selector: 'demo-product-card',
    standalone: false,
    templateUrl: './product-card.component.html',
    styleUrls: ['./product-card.component.scss'],
})
export class ProductCardComponent {
    /** 產品名稱 */
    @Input() name = 'Product Name';

    /** 產品價格 */
    @Input() price = 0;

    /** 原價（用於顯示折扣） */
    @Input() originalPrice?: number;

    /** 產品圖片 URL */
    @Input() imageUrl = 'https://via.placeholder.com/200';

    /** 是否有庫存 */
    @Input() inStock = true;

    /** 評分 (0-5) */
    @Input() rating = 0;

    /** 評論數量 */
    @Input() reviewCount = 0;

    /** 標籤列表 */
    @Input() tags: string[] = [];

    /** 加入購物車時觸發 */
    @Output() addToCart = new EventEmitter<{ name: string; price: number }>();

    /** 加入願望清單時觸發 */
    @Output() addToWishlist = new EventEmitter<string>();

    /** 計算折扣百分比 */
    get discountPercentage(): number | null {
        if (this.originalPrice && this.originalPrice > this.price) {
            return Math.round((1 - this.price / this.originalPrice) * 100);
        }
        return null;
    }

    /** 生成星星評分 */
    get stars(): string[] {
        const fullStars = Math.floor(this.rating);
        const hasHalfStar = this.rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        return [
            ...Array(fullStars).fill('★'),
            ...(hasHalfStar ? ['☆'] : []),
            ...Array(emptyStars).fill('☆'),
        ];
    }

    onAddToCart(): void {
        this.addToCart.emit({ name: this.name, price: this.price });
    }

    onAddToWishlist(): void {
        this.addToWishlist.emit(this.name);
    }
}
