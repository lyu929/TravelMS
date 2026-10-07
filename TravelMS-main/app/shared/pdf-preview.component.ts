import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

@Component({
  selector: 'app-pdf-preview',
  template: `<div class="pdf-preview" [attr.aria-busy]="loading()">
    <div class="pdf-toolbar" aria-label="PDF page controls">
      <button class="button secondary" (click)="turn(-1)" [disabled]="loading() || page() <= 1">
        Previous
      </button>
      <span aria-live="polite">Page {{ page() }} of {{ pages() || '…' }}</span>
      <button
        class="button secondary"
        (click)="turn(1)"
        [disabled]="loading() || page() >= pages()"
      >
        Next
      </button>
    </div>
    @if (loading()) {
      <p class="field-hint" role="status">Loading PDF preview…</p>
    }
    @if (error()) {
      <p class="field-error" role="alert">{{ error() }}</p>
    }
    <div #container class="pdf-page-container">
      <canvas
        #canvas
        role="img"
        [attr.aria-label]="name + ', PDF page ' + page()"
        [attr.data-rendered]="!loading() && !error()"
        [hidden]="!!error()"
      ></canvas>
    </div>
  </div>`,
})
export class PdfPreviewComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) url!: string;
  @Input() name = 'Receipt';
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('container') container!: ElementRef<HTMLDivElement>;
  loading = signal(true);
  error = signal('');
  page = signal(1);
  pages = signal(0);
  private document?: PDFDocumentProxy;
  private task?: PDFDocumentLoadingTask;
  private rendering?: RenderTask;
  private destroyed = false;

  async ngAfterViewInit() {
    try {
      const pdfjs = await import('pdfjs-dist');
      if (this.destroyed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf/pdf.worker.min.mjs';
      this.task = pdfjs.getDocument({
        url: this.url,
        withCredentials: true,
        cMapUrl: '/assets/pdf/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/assets/pdf/standard_fonts/',
        wasmUrl: '/assets/pdf/wasm/',
        enableXfa: false,
      });
      this.document = await this.task.promise;
      if (this.destroyed) return;
      this.pages.set(this.document.numPages);
      await this.render();
    } catch {
      this.fail();
    }
  }

  async turn(offset: number) {
    const next = this.page() + offset;
    if (this.loading() || next < 1 || next > this.pages()) return;
    this.page.set(next);
    await this.render();
  }

  private async render() {
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.document!.getPage(this.page());
      if (this.destroyed) return;
      const canvas = this.canvas.nativeElement;
      const base = page.getViewport({ scale: 1 });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(100, Math.min(this.container.nativeElement.clientWidth - 16, 760));
      const scale = Math.min(
        width / base.width,
        Math.sqrt(8_000_000 / (base.width * base.height * density * density)),
      );
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width * density);
      canvas.height = Math.floor(viewport.height * density);
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      this.rendering = page.render({
        canvas,
        viewport,
        transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0],
      });
      await this.rendering.promise;
      if (!this.destroyed) this.loading.set(false);
    } catch {
      this.fail();
    }
  }

  private fail() {
    if (this.destroyed) return;
    this.loading.set(false);
    this.error.set('Preview is unavailable. Download the receipt to view it.');
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.rendering?.cancel();
    void this.task?.destroy().catch(() => {});
  }
}
