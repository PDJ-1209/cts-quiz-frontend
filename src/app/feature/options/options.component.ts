import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-options',
  standalone: true,
  imports: [MatRadioModule, NgFor],
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.css']
})
export class OptionsComponent {
  @Input({ required: true }) options: string[] = [];
  @Input() selected: string | null = null;

  
@Output() selectedChange = new EventEmitter<string>();
onChange(value: string) { this.selectedChange.emit(value); }

}
