


import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BackgroundType, FontStyle, ThemeCategory, ThemeCreateModel, ThemeModel } from '../../models/theme.model';
import { ThemeStore } from '../../services/theme-store.service';

type ThemeCustomizeModel = {
  // Theme properties sent to backend
  name: string;
  textColor: string;
  accentColor: string;
  category: ThemeCategory;
  fontStyle: FontStyle;
  
  // Background properties for UI
  backgroundType: BackgroundType;
  backgroundValue: string;

  // UI helpers for gradient colors (will be sent as primaryColor/secondaryColor)
  gradientColor1: string;
  gradientColor2: string;

  // UI helpers for other background types (not sent to backend)
  solidColor: string;
  imageUrl: string;
};

@Component({
  selector: 'app-theme-customize',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './theme-customize.component.html',
  styleUrls: ['./theme-customize.component.css']
})
export class ThemeCustomizeComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private themeStore = inject(ThemeStore);

  roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
  hostId = localStorage.getItem('hostId') ?? 'H001';

  types: BackgroundType[] = ['solid', 'gradient', 'image'];
  categories: ThemeCategory[] = ['Professional', 'Creative', 'Dark', 'Light', 'Custom'];
  fonts: FontStyle[] = ['Arial', 'Comic Sans MS', 'Impact', 'Pacifico', 'Bangers', 'Lobster'];

  // Track if we're editing an existing theme
  editingThemeId?: number;
  isEditMode = false;

  // Image upload properties
  uploadedImageFile: File | null = null;
  uploadedImagePreview: string | null = null;

  // ✅ Single model for all UI
  model: ThemeCustomizeModel = {
    name: '',

    backgroundType: 'gradient',
    backgroundValue: '', // will be auto-generated

    textColor: '#ffffff',
    accentColor: '#6c5ce7',
    category: 'Custom',
    fontStyle: 'Arial',

    // ✅ solid
    solidColor: '#111111',

    // ✅ gradient
    gradientColor1: '#74b9ff',
    gradientColor2: '#a29bfe',

    // ✅ image
    imageUrl: ''
  };

  constructor() {
    // Check if we're editing an existing theme
    const navigation = this.router.getCurrentNavigation();
    const theme = navigation?.extras?.state?.['theme'] as ThemeModel | undefined;
    
    if (theme) {
      console.log('🔧 Edit mode detected. Theme data:', theme);
      this.isEditMode = true;
      this.editingThemeId = theme.id;
      this.populateFormFromTheme(theme);
    } else {
      console.log('✨ Create mode - no theme data received');
    }

    // build initial value
    this.updateBackgroundValue();
    // Apply initial preview
    setTimeout(() => this.applyPreviewToPage(), 0);
  }

  // Populate form when editing existing theme
  private populateFormFromTheme(theme: ThemeModel) {
    this.model.name = theme.name;
    this.model.textColor = theme.textColor;
    this.model.accentColor = theme.accentColor || '#6c5ce7';
    this.model.category = theme.category || 'Custom';
    this.model.fontStyle = theme.fontStyle || 'Arial';

    // ✅ IMPORTANT: Parse backgroundColor field if it exists
    // Backend stores: "solid:#color" | "image:url" | "gradient" | empty
    // We need to extract backgroundType and the actual value
    let detectedType: BackgroundType = 'gradient';
    
    if (theme.backgroundValue && theme.backgroundValue.startsWith('solid:')) {
      detectedType = 'solid';
      this.model.solidColor = theme.backgroundValue.substring(6); // Remove "solid:" prefix
    } else if (theme.backgroundValue && theme.backgroundValue.startsWith('image:')) {
      detectedType = 'image';
      this.model.imageUrl = theme.backgroundValue.substring(6); // Remove "image:" prefix
    } else if (theme.backgroundType) {
      detectedType = theme.backgroundType;
    }

    this.model.backgroundType = detectedType;

    // Populate type-specific fields based on detected backgroundType
    switch (detectedType) {
      case 'solid':
        // Already populated above, but fallback to other fields if needed
        if (!this.model.solidColor) {
          this.model.solidColor = theme.primaryColor || '#111111';
        }
        break;
      
      case 'gradient':
        this.model.gradientColor1 = theme.gradientColor1 || theme.primaryColor || '#74b9ff';
        this.model.gradientColor2 = theme.gradientColor2 || theme.secondaryColor || '#a29bfe';
        break;
      
      case 'image':
        // Already populated above, but fallback if needed
        if (!this.model.imageUrl) {
          this.model.imageUrl = theme.backgroundValue || '';
        }
        // Images also need gradient colors for overlay
        this.model.gradientColor1 = theme.gradientColor1 || theme.primaryColor || '#74b9ff';
        this.model.gradientColor2 = theme.gradientColor2 || theme.secondaryColor || '#a29bfe';
        break;
    }

    // ✅ Update backgroundValue after populating all fields
    this.updateBackgroundValue();
  }

  // ✅ Called when background type changes
  onBackgroundTypeChange() {
    // optional: set sensible defaults when switching
    switch (this.model.backgroundType) {
      case 'solid':
        this.model.solidColor ||= '#111111';
        break;
      case 'gradient':
        this.model.gradientColor1 ||= '#74b9ff';
        this.model.gradientColor2 ||= '#a29bfe';
        break;
      case 'image':
        this.model.imageUrl ||= '';
        break;
    }

    this.updateBackgroundValue();
    this.applyPreviewToPage();
  }

  // ✅ Call this whenever any background control changes
  onBackgroundControlChange() {
    this.updateBackgroundValue();
    this.applyPreviewToPage();
  }

  // ✅ Called when font style changes
  onFontStyleChange() {
    this.applyPreviewToPage();
  }

  // ✅ Helper method to map font style to CSS font-family
  private getFontFamily(fontStyle: string): string {
    switch (fontStyle) {
      case 'Arial':
        return 'Arial, Helvetica, sans-serif';
      case 'Comic Sans MS':
        return '"Comic Sans MS", "Brush Script MT", cursive';
      case 'Impact':
        return 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
      case 'Pacifico':
        return '"Pacifico", "Brush Script MT", sans-serif';
      case 'Bangers':
        return '"Bangers", "Impact", sans-serif';
      case 'Lobster':
        return '"Lobster", Georgia, serif';
      default:
        return 'Arial, Helvetica, sans-serif';
    }
  }

  // ✅ Apply current theme to the page background in real-time
  private applyPreviewToPage() {
    const body = document.body;
    const html = document.documentElement;
    const textColor = this.model.textColor || '#ffffff';
    
    // Get font family using helper method
    const fontFamily = this.getFontFamily(this.model.fontStyle || 'Arial');

    // Apply text color
    body.style.color = textColor;

    // Apply background based on type
    const bgType = this.model.backgroundType;
    const bgValue = this.model.backgroundValue;

    if (bgType === 'image') {
      body.style.cssText = `
        margin: 0;
        padding: 0;
        color: ${textColor};
        background-color: #000 !important;
        background-image: url("${bgValue}") !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        background-attachment: fixed !important;
        min-height: 100vh;
        font-family: ${fontFamily};
      `;
    } else {
      body.style.cssText = `
        margin: 0;
        padding: 0;
        color: ${textColor};
        background: ${bgValue} !important;
        min-height: 100vh;
        font-family: ${fontFamily};
      `;
    }
    
    // Also apply font to html element
    html.style.fontFamily = fontFamily;
  }

  // ✅ Generates ONE backgroundValue string for the chosen type
  private updateBackgroundValue() {
    const type = this.model.backgroundType;

    if (type === 'solid') {
      this.model.backgroundValue = this.model.solidColor;
      return;
    }

    if (type === 'gradient') {
      const c1 = this.model.gradientColor1;
      const c2 = this.model.gradientColor2;
      this.model.backgroundValue = `linear-gradient(135deg, ${c1}, ${c2})`;
      return;
    }

    if (type === 'image') {
      // keep only the URL (your preview already wraps url(...) in HTML)
      this.model.backgroundValue = (this.model.imageUrl || '').trim();
      return;
    }
  }

  // ✅ Preview style (uses only model fields)
  previewStyle(): Record<string, string> {
    const type = this.model.backgroundType;
    
    // Get font family using helper method
    const fontFamily = this.getFontFamily(this.model.fontStyle || 'Arial');

    // text always
    const style: Record<string, string> = {
      color: this.model.textColor,
      fontFamily: fontFamily
    };

    if (type === 'image') {
      style['background'] = '#000000';
      style['backgroundImage'] = this.model.backgroundValue ? `url(${this.model.backgroundValue})` : 'none';
      style['backgroundSize'] = 'cover';
      style['backgroundPosition'] = 'center';
      style['backgroundRepeat'] = 'no-repeat';
      return style;
    }

    // solid, gradient use backgroundValue directly
    style['background'] = this.model.backgroundValue;
    return style;
  }

  async save() {
    if (!this.model.name.trim()) {
      alert('Theme name is required');
      return;
    }

    // ✅ If user uploaded a file, upload it first to get Base64 URL
    if (this.uploadedImageFile) {
      console.log('📤 Uploading image file to server...');
      
      try {
        const uploadResult = await new Promise<{ imageUrl: string }>((resolve, reject) => {
          (this.themeStore as any).uploadThemeImage(this.uploadedImageFile!).subscribe({
            next: (result: any) => resolve(result),
            error: (err: any) => reject(err)
          });
        });
        
        console.log('✅ Image uploaded successfully:', uploadResult.imageUrl);
        this.model.imageUrl = uploadResult.imageUrl;
        
      } catch (error) {
        console.error('❌ Image upload failed:', error);
        alert('Failed to upload image. Please try again.');
        return;
      }
    }

    // ✅ Ensure backgroundValue is up-to-date before building payload
    this.updateBackgroundValue();

    console.log('💾 Save clicked - Current model state:');
    console.log('  backgroundType:', this.model.backgroundType);
    console.log('  backgroundValue:', this.model.backgroundValue);
    console.log('  imageUrl:', this.model.imageUrl);
    console.log('  solidColor:', this.model.solidColor);
    console.log('  gradientColor1:', this.model.gradientColor1);
    console.log('  gradientColor2:', this.model.gradientColor2);

    // ✅ IMPORTANT: Build backgroundColor based on backgroundType
    // This field tells backend which type of background is being used
    // Format: "solid:#color" | "image:url" | "gradient"
    let primaryColor: string;
    let secondaryColor: string;
    let backgroundColor: string;

    switch (this.model.backgroundType) {
      case 'solid':
        // ✅ For solid backgrounds: store the color with "solid:" prefix
        backgroundColor = `solid:${this.model.solidColor}`;
        primaryColor = this.model.solidColor;
        secondaryColor = this.model.solidColor;
        console.log('📦 Solid background - backgroundColor:', backgroundColor);
        break;
      
      case 'image':
        // ✅ For image backgrounds: store the URL with "image:" prefix
        const imageUrl = (this.model.imageUrl || '').trim();
        if (!imageUrl) {
          alert('Please enter an image URL');
          return;
        }
        backgroundColor = `image:${imageUrl}`;
        primaryColor = this.model.gradientColor1;
        secondaryColor = this.model.gradientColor2;
        console.log('📦 Image background - imageUrl:', imageUrl);
        console.log('📦 Image background - backgroundColor:', backgroundColor);
        break;
      
      case 'gradient':
      default:
        // ✅ For gradient backgrounds: store type as "gradient"
        // Backend uses primaryColor and secondaryColor for the gradient colors
        backgroundColor = 'gradient';
        primaryColor = this.model.gradientColor1;
        secondaryColor = this.model.gradientColor2;
        console.log('📦 Gradient background - backgroundColor:', backgroundColor);
        console.log('📦 Gradient colors:', primaryColor, secondaryColor);
        break;
    }

    // ✅ CRITICAL: Build the payload with all required fields
    // The backgroundColor field MUST be included and NOT be empty
    // Backend API endpoint must accept this field in the request body
    const payload: ThemeCreateModel = {
      name: this.model.name,
      textColor: this.model.textColor,
      accentColor: this.model.accentColor,
      primaryColor: primaryColor,
      secondaryColor: secondaryColor,
      backgroundColor: backgroundColor,  // ✅ This should be: "solid:#color", "image:url", or "gradient"
      imageUrl: this.model.backgroundType === 'image' ? this.model.imageUrl : undefined,  // ✅ Send imageUrl separately for image themes
      category: this.model.category,
      fontStyle: this.model.fontStyle
    };

    console.log(`🎨 ${this.isEditMode ? 'Updating' : 'Creating'} theme with payload:`, payload);
    console.log('📦 Payload imageUrl field:', payload.imageUrl);
    
    // ✅ DEBUGGING: Validate payload before sending
    if (!backgroundColor || backgroundColor === '') {
      console.error('❌ ERROR: backgroundColor is empty! This will cause DB save issues.');
      console.error('Current backgroundType:', this.model.backgroundType);
      console.error('Current model:', this.model);
      alert('ERROR: backgroundColor is empty. Check console for details.');
      return;
    }

    if (this.isEditMode && this.editingThemeId) {
      console.log('🔧 UPDATE mode - calling themeStore.updateTheme');
      console.log('Parameters:', { themeId: this.editingThemeId, hostId: this.hostId, payload });
      
      // ✅ Update existing theme via PUT request
      (this.themeStore as any).updateTheme(this.editingThemeId, this.hostId, payload).subscribe({
        next: (updatedTheme: any) => {
          console.log('✅ Theme updated successfully:', updatedTheme);
          alert(`Theme "${updatedTheme.name}" updated successfully!`);
          this.router.navigate([`/host/${this.roomId}/themes`]);
        },
        error: (err: any) => {
          console.error('❌ Update failed:', err);
          const errorMsg = err.error?.title || err.error?.message || err.message || 'Unknown error';
          alert(`Failed to update theme: ${errorMsg}\n\nCheck console for details.`);
        }
      });
    } else {
      console.log('✨ CREATE mode - calling themeStore.createTheme');
      
      // ✅ Create new theme via POST request
      this.themeStore.createTheme(payload, this.hostId).subscribe({
        next: (createdTheme: any) => {
          console.log('✅ Theme created successfully:', createdTheme);
          alert(`Theme "${createdTheme.name}" created successfully!`);
          this.router.navigate([`/host/${this.roomId}/themes`]);
        },
        error: (err: any) => {
          console.error('❌ Create failed:', err);
          console.error('❌ Error details:', err.error);
          console.error('❌ Error status:', err.status);
          console.error('❌ Error message:', err.message);
          
          let errorMsg = 'Unknown error';
          if (err.error) {
            if (typeof err.error === 'string') {
              errorMsg = err.error;
            } else if (err.error.title) {
              errorMsg = err.error.title;
            } else if (err.error.message) {
              errorMsg = err.error.message;
            } else if (err.error.errors) {
              errorMsg = JSON.stringify(err.error.errors);
            }
          }
          
          alert(`❌ Failed to create theme\n\nBackend Error (${err.status}):\n${errorMsg}\n\n💡 This is a BACKEND issue. The frontend is sending the data correctly.\n\nCheck:\n1. Backend Theme entity has BackgroundColor property\n2. Backend accepts backgroundColor in request\n3. Backend saves it to database\n4. Database column size is large enough for long URLs`);
        }
      });
    }
  }

  back() {
    this.router.navigate([`/host/${this.roomId}/themes`]);
  }

  // ✅ Handle image file selection from PC
  onImageFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    console.log('📁 Image file selected:', file.name, file.type, file.size);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('Image file is too large. Maximum size is 5MB.');
      return;
    }

    this.uploadedImageFile = file;

    // Generate preview using FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      this.uploadedImagePreview = e.target?.result as string;
      
      // Clear the URL input and use the preview
      this.model.imageUrl = this.uploadedImagePreview;
      this.onBackgroundControlChange();
      
      console.log('✅ Image preview generated');
    };
    reader.readAsDataURL(file);
  }

  // ✅ Remove uploaded image
  removeUploadedImage() {
    this.uploadedImageFile = null;
    this.uploadedImagePreview = null;
    this.model.imageUrl = '';
    this.onBackgroundControlChange();
    console.log('🗑️ Uploaded image removed');
  }

  // ✅ Handle manual URL change (when user types URL)
  onImageUrlChange() {
    // If user types a URL, clear the uploaded file
    if (this.model.imageUrl && this.model.imageUrl.trim()) {
      this.uploadedImageFile = null;
      this.uploadedImagePreview = null;
    }
    this.onBackgroundControlChange();
  }
}
