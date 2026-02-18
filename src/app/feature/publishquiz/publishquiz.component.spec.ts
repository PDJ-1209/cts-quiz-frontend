import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublishquizComponent } from './publishquiz.component';

describe('PublishquizComponent', () => {
  let component: PublishquizComponent;
  let fixture: ComponentFixture<PublishquizComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublishquizComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PublishquizComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
