import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import * as htmlToImage from 'html-to-image';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-qrcode',
  standalone: true,
  imports: [CommonModule, QRCodeComponent, MatSnackBarModule],
  templateUrl: './qrcode.component.html',
  styleUrl: './qrcode.component.css'
})
export class QrcodeComponent {
  @Input() quizNumber: string = '';
  @Input() quizId: string | number = '';
  @Input() showActions: boolean = true; // Show "Create Another Quiz" and download buttons
  @Output() newQuizClick = new EventEmitter<void>();
  
  @ViewChild('qrCard') qrCard!: ElementRef<HTMLElement>;

  // Computed QR data URL
  qrData = signal<string>('');

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.updateQrData();
  }

  ngOnChanges() {
    this.updateQrData();
  }

  private updateQrData() {
    if (this.quizNumber) {
      this.qrData.set(`http://localhost:4200/participant?quizNumber=${encodeURIComponent(this.quizNumber)}`);
    }
  }

  /** Download QR card as PNG image */
  async downloadQRCard() {
    if (!this.qrCard) return;
    
    try {
      // Wait a bit to ensure QR code is fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = this.qrCard.nativeElement;
      
      // Use toCanvas for better compatibility
      const dataUrl = await htmlToImage.toCanvas(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        filter: (node: any) => {
          // Exclude any elements that might cause issues
          if (node.tagName === 'BUTTON' && node.textContent?.includes('Download')) {
            return false;
          }
          return true;
        }
      }).then(canvas => canvas.toDataURL('image/png'));
      
      const link = document.createElement('a');
      link.download = `Quiz_QR_${this.quizNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating QR card image:', error);
      
      // Fallback: try with simpler options
      try {
        const dataUrl = await htmlToImage.toPng(this.qrCard.nativeElement, {
          backgroundColor: '#ffffff',
          pixelRatio: 1,
          quality: 1
        });
        
        const link = document.createElement('a');
        link.download = `Quiz_QR_${this.quizNumber}.png`;
        link.href = dataUrl;
        link.click();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        this.snackBar.open('⚠️ Failed to download QR card. Please try right-clicking on the card and select "Save image as..."', 'Close', {
          duration: 8000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
    }
  }

  onNewQuizClick() {
    this.newQuizClick.emit();
  }
}
