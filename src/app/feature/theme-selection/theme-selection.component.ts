import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeStore } from '../../services/theme-store.service';
import { ThemeModel } from '../../models/theme.model';
import { ThemeCardComponent } from '../theme-card/theme-card.component';

@Component({
  selector: 'app-theme-selection',
  standalone: true,
  imports: [CommonModule, ThemeCardComponent, FormsModule],
  templateUrl: './theme-selection.component.html',
  styleUrls: ['./theme-selection.component.css']
})
export class ThemeSelectionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private themeStore = inject(ThemeStore);

  roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
  hostId = localStorage.getItem('hostId') ?? 'H001';

  themes = this.themeStore.themes;
  loading = this.themeStore.loading;

  // Search functionality
  searchQuery = signal('');

  // Filter themes based on search query
  filteredThemes = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const allThemes = this.themes();
    
    if (!query) {
      return allThemes;
    }
    
    return allThemes.filter((theme: ThemeModel) => 
      theme.name.toLowerCase().includes(query) ||
      (theme.category || 'Custom').toLowerCase().includes(query)
    );
  });

  // Group themes by category
  themesByCategory = computed(() => {
    const themesToGroup = this.filteredThemes();
    const grouped = new Map<string, ThemeModel[]>();
    
    themesToGroup.forEach((theme: ThemeModel) => {
      const category = theme.category || 'Custom';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(theme);
    });

    // Convert to array and sort categories
    const categories = ['Professional', 'Creative', 'Dark', 'Light', 'Animation', 'Images', 'Custom'];
    return categories
      .filter(cat => grouped.has(cat))
      .map(cat => ({ category: cat, themes: grouped.get(cat)! }));
  });

  ngOnInit() {
    // Always load themes
    this.themeStore.loadThemes(this.hostId);
    
    // Log themes to see which ones have edit buttons
    setTimeout(() => {
      const allThemes = this.themes();
      console.log('📋 All themes loaded:', allThemes.length);
      console.log('Custom themes (editable):', allThemes.filter((t: ThemeModel) => !t.isDefault).length);
      console.log('Default themes (not editable):', allThemes.filter((t: ThemeModel) => t.isDefault).length);
      allThemes.forEach((t: ThemeModel) => {
        console.log(`  - ${t.name}: ${t.isDefault ? '🔒 Default' : '✏️ Editable'}`);
      });
    }, 1000);
    
    // Only init room sync if we have a valid roomId (not browsing themes for editing)
    if (this.roomId && this.roomId !== '' && this.roomId !== 'undefined') {
      console.log('🔗 Initializing room theme sync for room:', this.roomId);
      this.themeStore.initRoomThemeSync(this.roomId);
    } else {
      console.log('ℹ️ Skipping room sync - no valid roomId (edit/browse mode)');
    }
  }

  applyTheme(theme: ThemeModel) {
    console.log('🎨 Applying theme:', theme);
    
    // Apply theme to UI immediately - this changes the background
    this.themeStore.applyThemeToDocument(theme);
    this.themeStore.setSelectedTheme(theme);
    
    // Apply theme globally for the entire application
    console.log('✅ Theme applied successfully to the entire application:', theme.name);
  }

  apply(theme: ThemeModel) {
    console.log('Applying theme:', theme);
    // Use the store's applyTheme which handles everything
    this.themeStore.applyTheme(this.roomId, theme);
    // Navigate back to host dashboard
    this.router.navigate([`/host/${this.roomId}`]);
  }

  goCustomize() {
    this.router.navigate(['/host/themes/customize']);
  }

  goHome() {
    this.router.navigate(['/host/dashboard']);
  }

  editTheme(theme: ThemeModel) {
    console.log('✏️ Edit button clicked for theme:', theme);
    console.log('📍 Navigating to customize with state:', { theme });
    console.log('Navigation path:', '/host/themes/customize');
    
    // Navigate with theme data in router state
    this.router.navigate(['/host/themes/customize'], {
      state: { theme }
    }).then(success => {
      if (success) {
        console.log('✅ Navigation successful');
      } else {
        console.error('❌ Navigation failed');
      }
    }).catch(err => {
      console.error('❌ Navigation error:', err);
    });
  }

  deleteTheme(theme: ThemeModel) {
    console.log('🗑️ Delete button clicked for theme:', theme);
    
    // ✅ Confirm deletion before proceeding (already done in theme-card component)
    // ✅ Send DELETE request to backend
    this.themeStore.deleteTheme(theme.id, this.hostId).subscribe({
      next: () => {
        console.log('✅ Theme deleted successfully:', theme.name);
        alert(`Theme "${theme.name}" deleted successfully!`);
      },
      error: (err: any) => {
        console.error('❌ Delete failed:', err);
        const errorMsg = err.error?.title || err.error?.message || err.message || 'Unknown error';
        alert(`Failed to delete theme "${theme.name}": ${errorMsg}\n\nCheck console for details.`);
      }
    });
  }

  
}
