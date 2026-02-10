// import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// import { FeedbackService } from '../services/feedback.service';
// import { CommonModule } from '@angular/common';
 
// @Component({
//   selector: 'app-feedback-form',
//   standalone: true,
//   imports: [CommonModule, ReactiveFormsModule],
//   schemas: [CUSTOM_ELEMENTS_SCHEMA],
//   templateUrl: './feedback.component.html',
//   styleUrls: ['./feedback.component.css']
// })
// export class FeedbackFormComponent {
//   feedbackForm: FormGroup;
//   showPicker = false;
//   showWordCloud = false;
//   selectedWords: string[] = [];
//   emojiList = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪', '🦾', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '💢', '💥', '💫', '💦', '💨', '🔥', '⭐', '✨', '💖', '💗', '💓', '💞', '💕', '💟', '❣️'];
//   commentWords = [
//     'excellent', 'great', 'amazing', 'wonderful', 'good', 'nice', 'helpful', 'interesting',
//     'fun', 'engaging', 'creative', 'interactive', 'challenging', 'educational', 'informative',
//     'clear', 'easy', 'difficult', 'confusing', 'boring', 'long', 'short', 'perfect',
//     'awesome', 'fantastic', 'brilliant', 'outstanding', 'superb', 'impressive', 'enjoyable',
//     'useful', 'valuable', 'relevant', 'practical', 'effective', 'comprehensive', 'detailed',
//     'well-organized', 'well-designed', 'user-friendly', 'intuitive', 'innovative', 'unique',
//     'disappointing', 'poor', 'average', 'okay', 'decent', 'satisfactory', 'acceptable'
//   ];
 
//   constructor(private fb: FormBuilder, private service: FeedbackService) {
//     this.feedbackForm = this.fb.group({
//       id: [0],
//       quizId: ['', Validators.required],
//       participantId: ['', Validators.required],
//       rating: [5, Validators.required],
//       comments: [''],
//       emojiReaction: ['']
//     });
//   }

//   toggleWord(word: string) {
//     const index = this.selectedWords.indexOf(word);
//     if (index > -1) {
//       this.selectedWords.splice(index, 1);
//     } else {
//       this.selectedWords.push(word);
//     }
//     this.feedbackForm.patchValue({ comment: this.selectedWords.join(' ') });
//   }

//   clearWords() {
//     this.selectedWords = [];
//     this.feedbackForm.patchValue({ comment: '' });
//   }
 
//   selectEmoji(emoji: string) {
//     this.feedbackForm.patchValue({ emojiReaction: emoji });
//     this.showPicker = false;
//   }
 
//   addEmoji(event: any) {
//     const emoji = event.detail.unicode; // native emoji
//     this.feedbackForm.patchValue({ emojiReaction: emoji });
//     this.showPicker = false;
//   }
 
//   submit() {
//     console.log('Submit button clicked');
//     console.log('Form valid:', this.feedbackForm.valid);
//     console.log('Form values:', this.feedbackForm.value);
//     console.log('Form errors:', this.feedbackForm.errors);
    
//     if (this.feedbackForm.valid) {
//       console.log('Calling backend API...');
//       this.service.submitFeedback(this.feedbackForm.value).subscribe({
//         next: (response) => {
//           console.log('Success response:', response);
//           alert('Feedback submitted successfully to backend!');
//           this.feedbackForm.reset({ rating: 5 });
//           this.selectedWords = [];
//         },
//         error: err => {
//           console.error('Backend error:', err);
//           console.error('Error status:', err.status);
//           console.error('Error message:', err.message);
//           console.error('Error URL:', err.url);
//           console.error('Error details:', JSON.stringify(err, null, 2));
          
//           // Fallback to localStorage if backend fails
//           console.log('Backend not available, saving to localStorage...');
//           const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
//           const newFeedback = {
//             ...this.feedbackForm.value,
//             timestamp: new Date().toISOString()
//           };
//           feedbacks.push(newFeedback);
//           localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
//           alert('Backend is not available. Feedback saved locally!\n\nData: ' + JSON.stringify(newFeedback, null, 2));
//           this.feedbackForm.reset({ rating: 5 });
//           this.selectedWords = [];
//         }
//       });
//     } else {
//       console.log('Form is invalid. Cannot submit.');
//       alert('Please fill in all required fields (Quiz ID and Participant ID)');
//     }
//   }
// }  




// ============== New code =================


import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FeedbackService } from '../services/feedback.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-feedback-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './feedback.component.html',
  styleUrls: ['./feedback.component.css']
})
export class FeedbackFormComponent {
  feedbackForm: FormGroup;
  showPicker = false;
  showWordCloud = false;
  selectedWords: string[] = [];

  emojiList = ['😄','😀',  '🙂', '☹️','😞'];

  commentWords = [
    'excellent', 'great', 'amazing', 'wonderful', 'good', 'nice', 'helpful', 'interesting',
    'fun', 'engaging', 'creative', 'interactive', 'challenging', 'educational', 'informative',
    'clear', 'easy', 'difficult', 'confusing', 'boring', 'long', 'short', 'perfect',
    'awesome', 'fantastic', 'brilliant', 'outstanding', 'superb', 'impressive', 'enjoyable',
    'useful', 'valuable', 'relevant', 'practical', 'effective', 'comprehensive', 'detailed',
    'well-organized', 'well-designed', 'user-friendly', 'intuitive', 'innovative', 'unique',
    'disappointing', 'poor', 'average', 'okay', 'decent', 'satisfactory', 'acceptable'
  ];

  constructor(private fb: FormBuilder, private service: FeedbackService) {
    // IMPORTANT: use `comments` (plural) to match backend `Comments`
    this.feedbackForm = this.fb.group({
      id: [0],
      quizId: ['', Validators.required],
      participantId: ['', Validators.required],
      rating: [5, Validators.required],
      comments: [''],         // <-- renamed from `comment`
      emojiReaction: ['']
    });
  }

  toggleWord(word: string) {
    const index = this.selectedWords.indexOf(word);
    if (index > -1) {
      this.selectedWords.splice(index, 1);
    } else {
      this.selectedWords.push(word);
    }
    this.feedbackForm.patchValue({ comments: this.selectedWords.join(' ') });
  }

  clearWords() {
    this.selectedWords = [];
    this.feedbackForm.patchValue({ comments: '' });
  }

  selectEmoji(emoji: string) {
    this.feedbackForm.patchValue({ emojiReaction: emoji });
    this.showPicker = false;
  }

  addEmoji(event: any) {
    const emoji = event.detail.unicode; // native emoji
    this.feedbackForm.patchValue({ emojiReaction: emoji });
    this.showPicker = false;
  }

  submit() {
    console.log('Submit button clicked');
    console.log('Form valid:', this.feedbackForm.valid);
    console.log('Form values:', this.feedbackForm.value);
    console.log('Form errors:', this.feedbackForm.errors);

    if (this.feedbackForm.valid) {
      console.log('Calling backend API...');

      // Optional: ensure numeric fields are numbers
      const raw = this.feedbackForm.value;
      const payload = {
        ...raw,
        quizId: Number(raw.quizId),
        participantId: Number(raw.participantId)
      };

      this.service.submitFeedback(payload).subscribe({
        next: (response) => {
          console.log('Success response:', response);
          alert('Feedback submitted successfully to backend!');
          this.feedbackForm.reset({ rating: 5 });
          this.selectedWords = [];
        },
        error: (err) => {
          console.error('Backend error:', err);
          console.error('Error status:', err.status);
          console.error('Error message:', err.message);
          console.error('Error URL:', err.url);
          console.error('Error details:', JSON.stringify(err, null, 2));

          // Fallback to localStorage if backend fails
          console.log('Backend not available, saving to localStorage...');
          const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
          const newFeedback = {
            ...payload,
            timestamp: new Date().toISOString()
          };
          feedbacks.push(newFeedback);
          localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
          alert('Backend is not available. Feedback saved locally!\n\nData: ' + JSON.stringify(newFeedback, null, 2));
          this.feedbackForm.reset({ rating: 5 });
          this.selectedWords = [];
        }
      });
    } else {
      console.log('Form is invalid. Cannot submit.');
      alert('Please fill in all required fields (Quiz ID and Participant ID)');
    }
  }
}