import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-submit',
  standalone: true,
  imports: [],
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.css']
})
export class SubmitComponent {
  @Input() disabled = false;
  @Input() label = 'Submit Answer';
  @Output() clicked = new EventEmitter<void>();

  onClick() {
    console.log('[SubmitComponent] clicked');
    this.clicked.emit();
  }
}
