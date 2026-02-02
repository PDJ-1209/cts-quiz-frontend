import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizTabsComponent } from './quiz-tabs.component';

import { NgIf } from '@angular/common';

describe('QuizTabsComponent', () => {
  let component: QuizTabsComponent;
  let fixture: ComponentFixture<QuizTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizTabsComponent, NgIf]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
