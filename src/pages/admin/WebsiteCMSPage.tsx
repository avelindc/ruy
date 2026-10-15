import { useEffect, useState } from 'react';
import { Globe, MessageSquareQuote, HelpCircle, Layout, Plus, Edit3, Trash2, X, ArrowUp, ArrowDown, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Film, Play, Pause, Sliders } from 'lucide-react';
import { CmsLandingSection, CmsTestimonial, CmsFaqCategory, CmsFaqItem, CmsScrollytelling, CmsScrollytellingStep, getAdminSections, updateAdminSection, getAdminTestimonials, createAdminTestimonial, updateAdminTestimonial, deleteAdminTestimonial, getAdminFaqCategories, createAdminFaqCategory, updateAdminFaqCategory, deleteAdminFaqCategory, createAdminFaqItem, updateAdminFaqItem, deleteAdminFaqItem, getAdminScrollytelling, updateAdminScrollytelling, addAdminScrollytellingFrame, deleteAdminScrollytellingFrame, reorderAdminScrollytellingFrames } from '@services/cmsService';
import { ScrollytellingCanvas } from '../../components/scrollytelling/ScrollytellingCanvas';

export default function WebsiteCMSPage() {
  const [activeTab, setActiveTab] = useState<'testimonials' | 'faqs' | 'sections' | 'scrollytelling'>('testimonials');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Data states ---
  const [sections, setSections] = useState<CmsLandingSection[]>([]);
  const [testimonials, setTestimonials] = useState<CmsTestimonial[]>([]);
  const [faqCategories, setFaqCategories] = useState<CmsFaqCategory[]>([]);
  const [selectedFaqCatId, setSelectedFaqCatId] = useState<string>('');

  // --- Scrollytelling states ---
  const [scrollytelling, setScrollytelling] = useState<CmsScrollytelling | null>(null);
  const [scrollyForm, setScrollyForm] = useState({
    is_enabled: true,
    status: 'published' as 'published' | 'draft',
    bg_color: '#0B0B0E',
    scroll_height_vh: 400,
    canvas_aspect_ratio: '16/9',
    cta_label: 'Mulai Rilis Lagu Gratis',
    cta_url: '/register',
    text_steps: [] as CmsScrollytellingStep[],
  });
  const [scrollyPreviewProgress, setScrollyPreviewProgress] = useState<number>(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [newFrameUrl, setNewFrameUrl] = useState<string>('');
  const [isSavingScrolly, setIsSavingScrolly] = useState<boolean>(false);

  // --- Modal & Form states ---
  // Testimonial modal
  const [testimonialModalOpen, setTestimonialModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<CmsTestimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState({
    artist_name: '',
    avatar_url: '',
    role_label: 'Indie Artist',
    quote: '',
    display_order: 1,
    status: 'published' as 'draft' | 'published',
  });

  // Delete modal confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: 'testimonial' | 'faq_cat' | 'faq_item';
    id: string;
    title: string;
  }>({ open: false, type: 'testimonial', id: '', title: '' });

  // FAQ Category modal
  const [faqCatModalOpen, setFaqCatModalOpen] = useState(false);
  const [editingFaqCat, setEditingFaqCat] = useState<CmsFaqCategory | null>(null);
  const [faqCatForm, setFaqCatForm] = useState({
    name: '',
    description: '',
    display_order: 1,
    status: 'published' as 'draft' | 'published',
  });

  // FAQ Item modal
  const [faqItemModalOpen, setFaqItemModalOpen] = useState(false);
  const [editingFaqItem, setEditingFaqItem] = useState<CmsFaqItem | null>(null);
  const [faqItemForm, setFaqItemForm] = useState({
    category_id: '',
    question: '',
    answer: '',
    display_order: 1,
    status: 'published' as 'draft' | 'published',
  });

  // Section edit modal
  const [editingSection, setEditingSection] = useState<CmsLandingSection | null>(null);
  const [sectionForm, setSectionForm] = useState({
    title: '',
    subtitle: '',
    display_order: 1,
    is_enabled: true,
  });

  // FAQ accordion preview expanded state
  const [previewAccordion, setPreviewAccordion] = useState<Record<string, boolean>>({});

  const showNotify = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  // --- Load all CMS data ---
  const loadCmsData = async () => {
    setLoading(true);
    try {
      const [secRes, testRes, faqRes, scrollyRes] = await Promise.all([
        getAdminSections(),
        getAdminTestimonials(),
        getAdminFaqCategories(),
        getAdminScrollytelling(),
      ]);

      if (secRes.data) setSections(secRes.data);
      if (testRes.data) setTestimonials(testRes.data);
      if (faqRes.data) {
        setFaqCategories(faqRes.data);
        if (faqRes.data.length > 0 && !selectedFaqCatId) {
          setSelectedFaqCatId(faqRes.data[0].id);
        }
      }
      if (scrollyRes.data) {
        setScrollytelling(scrollyRes.data);
        setScrollyForm({
          is_enabled: scrollyRes.data.is_enabled,
          status: scrollyRes.data.status,
          bg_color: scrollyRes.data.bg_color || '#0B0B0E',
          scroll_height_vh: scrollyRes.data.scroll_height_vh || 400,
          canvas_aspect_ratio: scrollyRes.data.canvas_aspect_ratio || '16/9',
          cta_label: scrollyRes.data.cta_label || 'Mulai Rilis Lagu Gratis',
          cta_url: scrollyRes.data.cta_url || '/register',
          text_steps: scrollyRes.data.text_steps || [],
        });
      }
    } catch (err: any) {
      showNotify('error', 'Gagal memuat data CMS: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCmsData();
  }, []);

  // Auto playback effect for interactive preview scrubber
  useEffect(() => {
    let interval: any;
    if (isPlayingPreview) {
      interval = setInterval(() => {
        setScrollyPreviewProgress((prev) => {
          if (prev >= 1) {
            setIsPlayingPreview(false);
            return 1;
          }
          return Math.min(1, prev + 0.015);
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlayingPreview]);

  // Scrollytelling handlers
  const handleSaveScrollyConfig = async (statusOverride?: 'published' | 'draft') => {
    setIsSavingScrolly(true);
    try {
      const payload = {
        ...scrollyForm,
        ...(statusOverride ? { status: statusOverride } : {}),
      };
      const res = await updateAdminScrollytelling(payload);
      if (res.error) throw res.error;
      if (res.data) {
        setScrollytelling(res.data);
        setScrollyForm((prev) => ({
          ...prev,
          status: res.data!.status,
          is_enabled: res.data!.is_enabled,
        }));
      }
      showNotify(
        'success',
        statusOverride === 'published'
          ? 'Konfigurasi Scrollytelling berhasil dipublikasikan ke Landing Page!'
          : 'Konfigurasi Scrollytelling berhasil disimpan!'
      );
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan konfigurasi scrollytelling');
    } finally {
      setIsSavingScrolly(false);
    }
  };

  const handleStepChange = (index: number, field: keyof CmsScrollytellingStep, val: any) => {
    const updated = [...scrollyForm.text_steps];
    updated[index] = { ...updated[index], [field]: val };
    setScrollyForm({ ...scrollyForm, text_steps: updated });
  };

  const handleAddStep = () => {
    const newIdx = scrollyForm.text_steps.length;
    const newStep: CmsScrollytellingStep = {
      step_index: newIdx,
      badge: `${newIdx * 25}% • PESAN BARU`,
      title: 'Judul Pesan Scrollytelling',
      description: 'Deskripsi pesan animasi yang tampil saat pengguna melakukan scroll.',
      alignment: 'center',
      start_progress: Math.min(100, newIdx * 25),
      end_progress: Math.min(100, (newIdx + 1) * 25),
      is_active: true,
    };
    setScrollyForm({
      ...scrollyForm,
      text_steps: [...scrollyForm.text_steps, newStep],
    });
  };

  const handleDeleteStep = (index: number) => {
    const updated = scrollyForm.text_steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, step_index: i }));
    setScrollyForm({ ...scrollyForm, text_steps: updated });
  };

  const handleMoveFrame = async (frameIndex: number, direction: 'up' | 'down') => {
    if (!scrollytelling || !scrollytelling.frames) return;
    const currentFrames = [...scrollytelling.frames].sort((a, b) => a.frame_index - b.frame_index);
    const targetIndex = direction === 'up' ? frameIndex - 1 : frameIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentFrames.length) return;

    // Swap
    const temp = currentFrames[frameIndex];
    currentFrames[frameIndex] = currentFrames[targetIndex];
    currentFrames[targetIndex] = temp;

    const frameIds = currentFrames.map((f) => f.id);
    try {
      const res = await reorderAdminScrollytellingFrames(frameIds);
      if (res.data) {
        setScrollytelling(res.data);
      }
      showNotify('success', 'Urutan frame berhasil diperbarui!');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal mengubah urutan frame');
    }
  };

  const handleDeleteFrame = async (frameId: string) => {
    try {
      await deleteAdminScrollytellingFrame(frameId);
      if (scrollytelling) {
        const remaining = scrollytelling.frames.filter((f) => f.id !== frameId);
        setScrollytelling({ ...scrollytelling, frames: remaining });
      }
      showNotify('success', 'Frame berhasil dihapus');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menghapus frame');
    }
  };

  const handleAddFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrameUrl.trim()) return;

    try {
      const res = await addAdminScrollytellingFrame(newFrameUrl.trim());
      if (res.error) throw res.error;
      if (res.data && scrollytelling) {
        setScrollytelling({
          ...scrollytelling,
          frames: [...scrollytelling.frames, res.data],
        });
      }
      setNewFrameUrl('');
      showNotify('success', 'Frame baru berhasil ditambahkan');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menambahkan frame');
    }
  };

  // ============================================================================
  // TESTIMONIAL HANDLERS
  // ============================================================================

  const handleOpenTestimonialModal = (item?: CmsTestimonial) => {
    if (item) {
      setEditingTestimonial(item);
      setTestimonialForm({
        artist_name: item.artist_name,
        avatar_url: item.avatar_url || '',
        role_label: item.role_label,
        quote: item.quote,
        display_order: item.display_order,
        status: item.status,
      });
    } else {
      setEditingTestimonial(null);
      setTestimonialForm({
        artist_name: '',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        role_label: 'Musisi Independen',
        quote: '',
        display_order: testimonials.length + 1,
        status: 'published',
      });
    }
    setTestimonialModalOpen(true);
  };

  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialForm.artist_name.trim() || !testimonialForm.quote.trim()) {
      showNotify('error', 'Nama artis dan isi testimoni wajib diisi!');
      return;
    }

    try {
      if (editingTestimonial) {
        const { error } = await updateAdminTestimonial(editingTestimonial.id, testimonialForm);
        if (error) throw error;
        showNotify('success', 'Testimoni artis berhasil diperbarui.');
      } else {
        const { error } = await createAdminTestimonial(testimonialForm);
        if (error) throw error;
        showNotify('success', 'Testimoni artis baru berhasil ditambahkan.');
      }
      setTestimonialModalOpen(false);
      loadCmsData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan testimoni');
    }
  };

  const handleToggleTestimonialStatus = async (item: CmsTestimonial) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await updateAdminTestimonial(item.id, { status: nextStatus });
      if (error) throw error;
      showNotify('success', `Status testimoni "${item.artist_name}" diubah ke ${nextStatus}.`);
      loadCmsData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal mengubah status');
    }
  };

  // ============================================================================
  // FAQ CATEGORY HANDLERS
  // ============================================================================

  const handleOpenFaqCatModal = (cat?: CmsFaqCategory) => {
    if (cat) {
      setEditingFaqCat(cat);
      setFaqCatForm({
        name: cat.name,
        description: cat.description || '',
        display_order: cat.display_order,
        status: cat.status,
      });
    } else {
      setEditingFaqCat(null);
      setFaqCatForm({
        name: '',
        description: '',
        display_order: faqCategories.length + 1,
        status: 'published',
      });
    }
    setFaqCatModalOpen(true);
  };

  const handleSaveFaqCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqCatForm.name.trim()) {
      showNotify('error', 'Nama kategori FAQ wajib diisi!');
      return;
    }

    try {
      if (editingFaqCat) {
        const { error } = await updateAdminFaqCategory(editingFaqCat.id, faqCatForm);
        if (error) throw error;
        showNotify('success', 'Kategori FAQ berhasil diperbarui.');
      } else {
        const { error } = await createAdminFaqCategory(faqCatForm);
        if (error) throw error;
        showNotify('success', 'Kategori FAQ baru berhasil ditambahkan.');
      }
      setFaqCatModalOpen(false);
      loadCmsData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan kategori');
    }
  };

  // ============================================================================
  // FAQ ITEM HANDLERS
  // ============================================================================

  const handleOpenFaqItemModal = (item?: CmsFaqItem, defaultCatId?: string) => {
    const targetCatId = defaultCatId || selectedFaqCatId || (faqCategories[0]?.id || '');
    if (item) {
      setEditingFaqItem(item);
      setFaqItemForm({
        category_id: item.category_id,
        question: item.question,
        answer: item.answer,
        display_order: item.display_order,
        status: item.status,
      });
    } else {
      setEditingFaqItem(null);
      const currentCat = faqCategories.find(c => c.id === targetCatId);
      const currentCount = currentCat?.items?.length || 0;
      setFaqItemForm({
        category_id: targetCatId,
        question: '',
        answer: '',
        display_order: currentCount + 1,
        status: 'published',
      });
    }
    setFaqItemModalOpen(true);
  };

  const handleSaveFaqItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqItemForm.question.trim() || !faqItemForm.answer.trim()) {
      showNotify('error', 'Pertanyaan dan jawaban wajib diisi!');
      return;
    }

    try {
      if (editingFaqItem) {
        const { error } = await updateAdminFaqItem(editingFaqItem.id, faqItemForm);
        if (error) throw error;
        showNotify('success', 'Pertanyaan FAQ berhasil diperbarui.');
      } else {
        const { error } = await createAdminFaqItem(faqItemForm);
        if (error) throw error;
        showNotify('success', 'Pertanyaan FAQ baru berhasil ditambahkan.');
      }
      setFaqItemModalOpen(false);
      loadCmsData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan item FAQ');
    }
  };

  // ============================================================================
  // SECTION MANAGER HANDLERS
  // ============================================================================

  const handleToggleSection = async (section: CmsLandingSection) => {
    try {
      const nextState = !section.is_enabled;
      const { error } = await updateAdminSection(section.id, { is_enabled: nextState });
      if (error) throw error;
      showNotify('success', `Section "${section.title}" berhasil ${nextState ? 'diaktifkan' : 'disembunyikan'}.`);
      loadCmsData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal mengubah section');
    }
  };

  const handleOpenEditSection = (sec: CmsLandingSection) => {
    setEditingSection(sec);
    setSectionForm({
      title: sec.title,
      subtitle: sec.subtitle || '',
      display_order: sec.display_order,
      is_enabled: sec.is_enabled,
    });
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;

    try {
      const { error } = await updateAdminSection(editingSection.id, sectionForm);
      if (error) throw error;
      showNotify('success', `Section "${sectionForm.title}" berhasil diperbarui.`);
      setEditingSection(null);
      loadCmsData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan section');
    }
  };

  // ============================================================================
  // DELETE DISPATCHER
  // ============================================================================

  const handleConfirmDelete = async () => {
    const { type, id } = deleteConfirm;
    try {
      if (type === 'testimonial') {
        const { error } = await deleteAdminTestimonial(id);
        if (error) throw error;
        showNotify('success', 'Testimoni artis berhasil dihapus.');
      } else if (type === 'faq_cat') {
        const { error } = await deleteAdminFaqCategory(id);
        if (error) throw error;
        showNotify('success', 'Kategori FAQ berhasil dihapus.');
      } else if (type === 'faq_item') {
        const { error } = await deleteAdminFaqItem(id);
        if (error) throw error;
        showNotify('success', 'Item FAQ berhasil dihapus.');
      }
      setDeleteConfirm({ open: false, type: 'testimonial', id: '', title: '' });
      loadCmsData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menghapus');
    }
  };

  const activeCategory = faqCategories.find(c => c.id === selectedFaqCatId) || faqCategories[0];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-gray-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Globe className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Website CMS Manager
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Kelola konten dinamis landing page: Testimoni Artis (“REAL FEEDBACK / WHAT ARTISTS SAY”), FAQ Accordion 5 Kategori, dan urutan section.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadCmsData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-gray-300 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sinkron Data</span>
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4F67FF] hover:bg-[#435BFF] text-white text-xs font-bold transition-all shadow-[0_4px_16px_rgba(79,103,255,0.3)] cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Pratinjau Landing Page</span>
          </a>
        </div>
      </div>

      {/* Notification Banner */}
      {actionMsg && (
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl border text-sm font-medium transition-all ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {actionMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* CMS Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#14141B] border border-white/[0.08] w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('testimonials')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'testimonials'
              ? 'bg-[#4F67FF] text-white shadow-[0_4px_12px_rgba(79,103,255,0.35)]'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <MessageSquareQuote className="w-4 h-4" />
          <span>Artist Testimonials ({testimonials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('faqs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'faqs'
              ? 'bg-[#4F67FF] text-white shadow-[0_4px_12px_rgba(79,103,255,0.35)]'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>FAQ Manager ({faqCategories.length} Kategori)</span>
        </button>

        <button
          onClick={() => setActiveTab('sections')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'sections'
              ? 'bg-[#4F67FF] text-white shadow-[0_4px_12px_rgba(79,103,255,0.35)]'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Section Manager ({sections.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('scrollytelling')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'scrollytelling'
              ? 'bg-lime-400 text-neutral-950 shadow-[0_4px_12px_rgba(163,230,53,0.35)] font-black'
              : 'text-lime-400 hover:text-lime-300 hover:bg-lime-400/10'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Scroll Animation ({scrollytelling?.frames?.length || 0} Frames)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ARTIST TESTIMONIALS */}
      {/* ========================================================================= */}
      {activeTab === 'testimonials' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#14141B] border border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-lime-400 uppercase tracking-widest">
                  REAL FEEDBACK / WHAT ARTISTS SAY
                </span>
                <span className="px-2 py-0.5 rounded-full bg-lime-400/10 border border-lime-400/20 text-[10px] font-bold text-lime-400">
                  Landing Section
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">Daftar Testimoni Artis</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Kelola kutipan ulasan riil dari musisi, produser, dan band yang menggunakan Breakout Music.
              </p>
            </div>

            <button
              onClick={() => handleOpenTestimonialModal()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-black font-bold text-xs transition-all shadow-[0_4px_16px_rgba(163,230,53,0.3)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Testimoni</span>
            </button>
          </div>

          {/* Testimonials Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-3xl bg-[#14141B] border border-white/[0.08] hover:border-lime-400/30 transition-all flex flex-col justify-between space-y-4 relative group"
              >
                <div className="space-y-3">
                  {/* Status & Order Bar */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-400 border border-white/[0.06]">
                      Urutan: #{item.display_order}
                    </span>
                    <button
                      onClick={() => handleToggleTestimonialStatus(item)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                        item.status === 'published'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                      }`}
                    >
                      {item.status === 'published' ? '● Published' : '○ Draft'}
                    </button>
                  </div>

                  {/* Quote */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.04] relative">
                    <MessageSquareQuote className="w-5 h-5 text-lime-400/60 mb-1" />
                    <p className="text-xs text-gray-300 italic leading-relaxed line-clamp-4">
                      "{item.quote}"
                    </p>
                  </div>

                  {/* Artist Info */}
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={item.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80'}
                      alt={item.artist_name}
                      className="w-11 h-11 rounded-full object-cover border border-white/[0.1] bg-[#1A1A24]"
                      onError={(e) => {
                        (e.target as any).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80';
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{item.artist_name}</p>
                      <p className="text-[11px] font-medium text-lime-400 truncate">{item.role_label}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleOpenTestimonialModal(item)}
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() =>
                      setDeleteConfirm({
                        open: true,
                        type: 'testimonial',
                        id: item.id,
                        title: `Testimoni artis "${item.artist_name}"`,
                      })
                    }
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {testimonials.length === 0 && !loading && (
            <div className="text-center py-16 bg-[#14141B] rounded-3xl border border-white/[0.08] p-6 space-y-3">
              <MessageSquareQuote className="w-12 h-12 text-gray-500 mx-auto" />
              <p className="text-sm font-bold text-white">Belum ada testimoni artis</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Tambahkan testimoni pertama untuk ditampilkan di landing page Breakout Music.
              </p>
              <button
                onClick={() => handleOpenTestimonialModal()}
                className="px-4 py-2 rounded-xl bg-lime-400 text-black font-bold text-xs cursor-pointer"
              >
                + Tambah Testimoni Baru
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FAQ MANAGER */}
      {/* ========================================================================= */}
      {activeTab === 'faqs' && (
        <div className="space-y-6">
          {/* Categories Top Bar */}
          <div className="p-5 rounded-3xl bg-[#14141B] border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                  Kategori FAQ Landing Page
                </span>
                <h2 className="text-xl font-black text-white mt-1">FAQ Accordion Manager</h2>
                <p className="text-xs text-gray-400">
                  Kelola kategori (FAQ Umum, FAQ CTM, FAQ DMD, FAQ Royalty, FAQ Rilis) serta tambah kategori baru kapan saja.
                </p>
              </div>

              <button
                onClick={() => handleOpenFaqCatModal()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition-all shadow-[0_4px_16px_rgba(79,103,255,0.3)] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori FAQ</span>
              </button>
            </div>

            {/* Category Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1">
              {faqCategories.map((cat) => {
                const isSelected = (selectedFaqCatId || faqCategories[0]?.id) === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedFaqCatId(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-[#4F67FF] text-white border-indigo-400 shadow-[0_4px_12px_rgba(79,103,255,0.4)]'
                        : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">
                      {cat.items?.length || 0}
                    </span>
                    <span className={`text-[9px] px-1 py-0.2 rounded ${cat.status === 'published' ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {cat.status === 'published' ? '✓' : '•'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Category Details & FAQ Items List */}
          {activeCategory && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Info & Controls */}
              <div className="lg:col-span-4 p-5 rounded-3xl bg-[#14141B] border border-white/[0.08] space-y-4 h-fit">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-400">ID: {activeCategory.id}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    activeCategory.status === 'published'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {activeCategory.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white">{activeCategory.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {activeCategory.description || 'Tidak ada deskripsi'}
                  </p>
                  <p className="text-[11px] text-indigo-400 font-mono mt-2">
                    Slug: #{activeCategory.slug} | Urutan: {activeCategory.display_order}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleOpenFaqCatModal(activeCategory)}
                    className="flex-1 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Edit Kategori</span>
                  </button>
                  <button
                    onClick={() =>
                      setDeleteConfirm({
                        open: true,
                        type: 'faq_cat',
                        id: activeCategory.id,
                        title: `Kategori "${activeCategory.name}" beserta seluruh FAQ di dalamnya`,
                      })
                    }
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                    title="Hapus Kategori"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Questions Accordion List in this Category */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-base font-black text-white">
                      Pertanyaan &amp; Jawaban ({activeCategory.name})
                    </h3>
                    <p className="text-xs text-gray-400">
                      Tampil sebagai accordion interaktif di landing page Breakout Music.
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenFaqItemModal(undefined, activeCategory.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-[0_4px_14px_rgba(16,185,129,0.3)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah FAQ Item</span>
                  </button>
                </div>

                {/* FAQ Items Accordion Cards */}
                <div className="space-y-3">
                  {(activeCategory.items || []).map((faq) => {
                    const isOpen = previewAccordion[faq.id] ?? false;
                    return (
                      <div
                        key={faq.id}
                        className="rounded-2xl bg-[#14141B] border border-white/[0.08] hover:border-white/[0.15] transition-all overflow-hidden"
                      >
                        <div className="p-4 flex items-center justify-between gap-3">
                          <button
                            onClick={() =>
                              setPreviewAccordion((prev) => ({ ...prev, [faq.id]: !isOpen }))
                            }
                            className="flex items-center gap-3 text-left flex-1 cursor-pointer"
                          >
                            <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              #{faq.display_order}
                            </span>
                            <span className="text-sm font-bold text-white group-hover:text-indigo-300">
                              {faq.question}
                            </span>
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 ml-auto" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-auto" />
                            )}
                          </button>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                faq.status === 'published'
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              }`}
                            >
                              {faq.status}
                            </span>
                            <button
                              onClick={() => handleOpenFaqItemModal(faq, activeCategory.id)}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-indigo-300 cursor-pointer"
                              title="Edit Pertanyaan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteConfirm({
                                  open: true,
                                  type: 'faq_item',
                                  id: faq.id,
                                  title: `Pertanyaan: "${faq.question}"`,
                                })
                              }
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                              title="Hapus Pertanyaan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 text-xs text-gray-300 leading-relaxed border-t border-white/[0.04] bg-white/[0.02]">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(!activeCategory.items || activeCategory.items.length === 0) && (
                    <div className="text-center py-10 bg-[#14141B] rounded-2xl border border-white/[0.08] p-5">
                      <HelpCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-white">Belum ada pertanyaan di kategori ini</p>
                      <button
                        onClick={() => handleOpenFaqItemModal(undefined, activeCategory.id)}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        + Tambah FAQ Pertama
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SECTION MANAGER */}
      {/* ========================================================================= */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-[#14141B] border border-white/[0.08]">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Tata Letak Landing Page
            </span>
            <h2 className="text-xl font-black text-white mt-1">Section Layout &amp; Visibility</h2>
            <p className="text-xs text-gray-400">
              Aktifkan/nonaktifkan section, atur judul tampilan, dan urutan rendering landing page Breakout Music.
            </p>
          </div>

          <div className="space-y-3">
            {sections
              .sort((a, b) => a.display_order - b.display_order)
              .map((section) => (
                <div
                  key={section.id}
                  className="p-5 rounded-3xl bg-[#14141B] border border-white/[0.08] hover:border-white/[0.15] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      #{section.display_order}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white">{section.title}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-gray-400">
                          {section.section_key}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {section.subtitle || 'Komponen bawaan landing page'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleSection(section)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                        section.is_enabled
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-white/[0.04] border-white/[0.08] text-gray-400'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${section.is_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                      <span>{section.is_enabled ? 'Aktif (Ditampilkan)' : 'Disembunyikan'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditSection(section)}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Ubah</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SCROLL ANIMATION (SCROLLYTELLING) */}
      {/* ========================================================================= */}
      {activeTab === 'scrollytelling' && (
        <div className="space-y-8">
          {/* Section Header & Global Save Bar */}
          <div className="p-6 rounded-3xl bg-[#14141B] border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-lime-400/10 border border-lime-400/30 text-lime-400">
                  <Film className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-lime-400 uppercase tracking-widest">
                  CANVAS SCROLLYTELLING ENGINE
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Scroll Animation Manager</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl">
                Atur animasi frame-by-frame 3D yang mengikuti posisi scroll pengguna, konfigurasi 4 babak narasi cerita (0%, 30%, 60%, 90%), panjang scroll (vh), serta urutan frame gambar WebP/JPG.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleSaveScrollyConfig('draft')}
                disabled={isSavingScrolly}
                className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-gray-200 border border-white/[0.1] transition-all cursor-pointer"
              >
                Simpan Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveScrollyConfig('published')}
                disabled={isSavingScrolly}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-neutral-950 font-black text-xs transition-all shadow-[0_4px_16px_rgba(163,230,53,0.35)] cursor-pointer"
              >
                {isSavingScrolly ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Publikasikan ke Landing Page</span>
              </button>
            </div>
          </div>

          {/* Interactive Live Scrubber Preview */}
          <div className="p-6 rounded-3xl bg-[#14141B] border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Live Interactive Scrubber Preview</h3>
                  <p className="text-[11px] text-gray-400">
                    Geser slider atau tekan Play untuk menguji animasi frame dan transisi teks narasi secara realtime.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlayingPreview(!isPlayingPreview)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isPlayingPreview
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 border border-white/[0.08]'
                  }`}
                >
                  {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-lime-400" />}
                  <span>{isPlayingPreview ? 'Jeda Simulasi' : 'Putar Otomatis'}</span>
                </button>
                <div className="px-3 py-1 rounded-lg bg-black/60 border border-white/[0.08] text-xs font-mono text-lime-400 font-bold">
                  {Math.round(scrollyPreviewProgress * 100)}%
                </div>
              </div>
            </div>

            {/* Canvas Preview Container */}
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] bg-black h-[420px] shadow-2xl">
              <ScrollytellingCanvas
                config={{
                  ...scrollyForm,
                  id: scrollytelling?.id || 'main',
                  frames: scrollytelling?.frames || [],
                }}
                isPreview={true}
                previewProgress={scrollyPreviewProgress}
              />
            </div>

            {/* Scrubber Control Range */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-medium text-gray-400">
                <span className="font-mono text-lime-400">0% (Awal)</span>
                <span className="font-mono">30% (Fitur 1)</span>
                <span className="font-mono">60% (Fitur 2)</span>
                <span className="font-mono">90% (Final CTA)</span>
                <span className="font-mono text-lime-400">100% (Akhir)</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.002"
                value={scrollyPreviewProgress}
                onChange={(e) => {
                  setIsPlayingPreview(false);
                  setScrollyPreviewProgress(parseFloat(e.target.value));
                }}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
              />
            </div>
          </div>

          {/* Configuration Form: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Global Settings */}
            <div className="p-6 rounded-3xl bg-[#14141B] border border-white/[0.08] space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime-400" />
                Konfigurasi Viewport &amp; Animasi
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Status Publikasi</label>
                  <select
                    value={scrollyForm.status}
                    onChange={(e) => setScrollyForm({ ...scrollyForm, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-lime-400"
                  >
                    <option value="published">Published (Tayang di Landing Page)</option>
                    <option value="draft">Draft (Disimpan saja)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Visibilitas Section</label>
                  <select
                    value={scrollyForm.is_enabled ? 'true' : 'false'}
                    onChange={(e) => setScrollyForm({ ...scrollyForm, is_enabled: e.target.value === 'true' })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-lime-400"
                  >
                    <option value="true">Aktif (Tampilkan)</option>
                    <option value="false">Nonaktif (Sembunyikan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Panjang Scroll (vh)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="200"
                      max="1200"
                      step="50"
                      value={scrollyForm.scroll_height_vh}
                      onChange={(e) => setScrollyForm({ ...scrollyForm, scroll_height_vh: parseInt(e.target.value, 10) || 400 })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-lime-400"
                    />
                    <span className="text-xs text-gray-400 font-mono">vh</span>
                  </div>
                  <span className="text-[10px] text-gray-500">Rekomendasi: 350-500 vh untuk scrubbing halus</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Warna Background Canvas</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={scrollyForm.bg_color}
                      onChange={(e) => setScrollyForm({ ...scrollyForm, bg_color: e.target.value })}
                      className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={scrollyForm.bg_color}
                      onChange={(e) => setScrollyForm({ ...scrollyForm, bg_color: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white font-mono focus:outline-none focus:border-lime-400"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">Default: #0B0B0E menyatu dengan visual frame</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Label Tombol CTA Final</label>
                  <input
                    type="text"
                    value={scrollyForm.cta_label}
                    onChange={(e) => setScrollyForm({ ...scrollyForm, cta_label: e.target.value })}
                    placeholder="Mulai Rilis Lagu Gratis"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-lime-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Target URL CTA</label>
                  <input
                    type="text"
                    value={scrollyForm.cta_url}
                    onChange={(e) => setScrollyForm({ ...scrollyForm, cta_url: e.target.value })}
                    placeholder="/register atau #rilis"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-lime-400"
                  />
                </div>
              </div>
            </div>

            {/* Quick Frame Info & Sequence stats */}
            <div className="p-6 rounded-3xl bg-[#14141B] border border-white/[0.08] space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Informasi &amp; Format Frame Sequence
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Total Frame Terpasang</span>
                  <span className="text-2xl font-black text-lime-400 mt-1 block">
                    {scrollytelling?.frames?.length || 0} Frames
                  </span>
                  <span className="text-[10px] text-gray-500">Rasio 16:9 • Contain mode</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Format Utama</span>
                  <span className="text-2xl font-black text-indigo-400 mt-1 block">WebP / JPG</span>
                  <span className="text-[10px] text-gray-500">Kompresi hemat bandwidth</span>
                </div>
              </div>

              {/* Form Tambah Frame Baru */}
              <form onSubmit={handleAddFrame} className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-gray-300">Tambah URL Frame Baru (WebP / JPG)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFrameUrl}
                    onChange={(e) => setNewFrameUrl(e.target.value)}
                    placeholder="/scroll-frames/ezgif-frame-041.jpg atau URL Cloudflare R2"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-lime-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition-all cursor-pointer flex-shrink-0"
                  >
                    + Tambah
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Section: Story Text Steps Editor */}
          <div className="p-6 rounded-3xl bg-[#14141B] border border-white/[0.08] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-lime-400" />
                  Editor Babak Cerita Teks Animasi ({scrollyForm.text_steps.length} Babak)
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Atur teks headline utama (0%), fitur audio CTM (30%), fitur distribusi DSP (60%), dan final pesan CTA (90%).
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-bold text-white border border-white/[0.08] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-lime-400" />
                <span>Tambah Babak Cerita</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scrollyForm.text_steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-[#0B0B0E] border border-white/[0.08] hover:border-lime-400/30 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-lime-400/10 text-lime-400 font-mono text-[11px] font-bold border border-lime-400/20">
                      STEP #{idx + 1} • {step.start_progress}% - {step.end_progress}%
                    </span>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.is_active}
                          onChange={(e) => handleStepChange(idx, 'is_active', e.target.checked)}
                          className="rounded border-gray-700 text-lime-400 focus:ring-0"
                        />
                        <span>Aktif</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(idx)}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Hapus Step"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badge & Alignment */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 mb-1">Badge Text</label>
                      <input
                        type="text"
                        value={step.badge}
                        onChange={(e) => handleStepChange(idx, 'badge', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#14141B] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-lime-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 mb-1">Posisi Alignment</label>
                      <select
                        value={step.alignment}
                        onChange={(e) => handleStepChange(idx, 'alignment', e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#14141B] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-lime-400"
                      >
                        <option value="center">Tengah (Center)</option>
                        <option value="left">Rata Kiri (Left)</option>
                        <option value="right">Rata Kanan (Right)</option>
                      </select>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Judul / Headline</label>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => handleStepChange(idx, 'title', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#14141B] border border-white/[0.08] text-xs text-white font-bold focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Deskripsi Cerita</label>
                    <textarea
                      rows={2}
                      value={step.description}
                      onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#14141B] border border-white/[0.08] text-xs text-gray-300 leading-relaxed focus:outline-none focus:border-lime-400 resize-none"
                    />
                  </div>

                  {/* Progress Range slider inputs */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.04]">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Mulai Tampil (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={step.start_progress}
                        onChange={(e) => handleStepChange(idx, 'start_progress', parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2.5 py-1 rounded-md bg-[#14141B] border border-white/[0.08] text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Selesai Tampil (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={step.end_progress}
                        onChange={(e) => handleStepChange(idx, 'end_progress', parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2.5 py-1 rounded-md bg-[#14141B] border border-white/[0.08] text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Frame Sequence Gallery & Reorder Manager */}
          <div className="p-6 rounded-3xl bg-[#14141B] border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  Daftar Urutan Frame Gambar ({scrollytelling?.frames?.length || 0} Frames)
                </h3>
                <p className="text-xs text-gray-400">
                  Frame dimuat berurutan saat scroll ke bawah dan mundur saat scroll ke atas. Gunakan panah untuk mengatur urutan frame.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-3 max-h-[500px] overflow-y-auto p-1">
              {(scrollytelling?.frames || [])
                .sort((a, b) => a.frame_index - b.frame_index)
                .map((frame, fIdx, arr) => (
                  <div
                    key={frame.id}
                    className="p-2.5 rounded-2xl bg-[#0B0B0E] border border-white/[0.08] hover:border-lime-400/50 transition-all flex flex-col justify-between group"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-2">
                      <img
                        src={frame.frame_url}
                        alt={`Frame #${frame.frame_index + 1}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-lime-400 font-bold">
                        #{String(fIdx + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <p className="text-[10px] text-gray-400 font-mono truncate px-1" title={frame.frame_url}>
                      {frame.frame_url.split('/').pop()}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={fIdx === 0}
                          onClick={() => handleMoveFrame(fIdx, 'up')}
                          className="p-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 disabled:opacity-30 cursor-pointer"
                          title="Pindah ke Atas"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={fIdx === arr.length - 1}
                          onClick={() => handleMoveFrame(fIdx, 'down')}
                          className="p-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 disabled:opacity-30 cursor-pointer"
                          title="Pindah ke Bawah"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteFrame(frame.id)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Hapus Frame"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-end gap-3 p-4 rounded-2xl bg-[#14141B] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleSaveScrollyConfig('draft')}
              disabled={isSavingScrolly}
              className="px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-bold text-white transition-all cursor-pointer"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              onClick={() => handleSaveScrollyConfig('published')}
              disabled={isSavingScrolly}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-neutral-950 font-black text-xs transition-all shadow-[0_4px_16px_rgba(163,230,53,0.35)] cursor-pointer"
            >
              {isSavingScrolly ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Publikasikan ke Landing Page</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TESTIMONIAL ADD/EDIT */}
      {/* ========================================================================= */}
      {testimonialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14141B] border border-white/[0.1] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-lime-400" />
                <h3 className="text-lg font-black text-white">
                  {editingTestimonial ? 'Edit Testimoni Artis' : 'Tambah Testimoni Artis Baru'}
                </h3>
              </div>
              <button
                onClick={() => setTestimonialModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTestimonial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Nama Artis / Band *</label>
                <input
                  type="text"
                  required
                  value={testimonialForm.artist_name}
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, artist_name: e.target.value })}
                  placeholder="Contoh: Senja Harmony"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lime-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Jabatan / Role Label *</label>
                <input
                  type="text"
                  required
                  value={testimonialForm.role_label}
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, role_label: e.target.value })}
                  placeholder="Contoh: Indie Pop Band / Producer"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lime-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">URL Foto / Avatar Artis</label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={testimonialForm.avatar_url}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, avatar_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lime-400"
                  />
                  {testimonialForm.avatar_url && (
                    <img
                      src={testimonialForm.avatar_url}
                      alt="Preview"
                      className="w-10 h-10 rounded-full object-cover border border-lime-400/50"
                      onError={(e) => {
                        (e.target as any).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80';
                      }}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Isi Kutipan / Ulasan *</label>
                <textarea
                  rows={4}
                  required
                  value={testimonialForm.quote}
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, quote: e.target.value })}
                  placeholder="Pengalaman nyata menggunakan Breakout Music..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lime-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    min="1"
                    value={testimonialForm.display_order}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, display_order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-lime-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Status Publikasi</label>
                  <select
                    value={testimonialForm.status}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-lime-400"
                  >
                    <option value="published">Published (Tampil)</option>
                    <option value="draft">Draft (Sembunyikan)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setTestimonialModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-gray-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-black font-bold text-xs transition-all shadow-[0_4px_16px_rgba(163,230,53,0.3)] cursor-pointer"
                >
                  {editingTestimonial ? 'Simpan Perubahan' : 'Tambahkan Testimoni'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FAQ CATEGORY ADD/EDIT */}
      {/* ========================================================================= */}
      {faqCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14141B] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-white">
                  {editingFaqCat ? 'Edit Kategori FAQ' : 'Tambah Kategori FAQ Baru'}
                </h3>
              </div>
              <button onClick={() => setFaqCatModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFaqCat} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Nama Kategori *</label>
                <input
                  type="text"
                  required
                  value={faqCatForm.name}
                  onChange={(e) => setFaqCatForm({ ...faqCatForm, name: e.target.value })}
                  placeholder="Contoh: FAQ Umum, FAQ CTM, FAQ DMD..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Deskripsi Singkat</label>
                <input
                  type="text"
                  value={faqCatForm.description}
                  onChange={(e) => setFaqCatForm({ ...faqCatForm, description: e.target.value })}
                  placeholder="Deskripsi topik bahasan..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Urutan Tab</label>
                  <input
                    type="number"
                    min="1"
                    value={faqCatForm.display_order}
                    onChange={(e) => setFaqCatForm({ ...faqCatForm, display_order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Status</label>
                  <select
                    value={faqCatForm.status}
                    onChange={(e) => setFaqCatForm({ ...faqCatForm, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setFaqCatModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-xs font-semibold text-gray-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FAQ ITEM ADD/EDIT */}
      {/* ========================================================================= */}
      {faqItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14141B] border border-white/[0.1] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">
                  {editingFaqItem ? 'Edit Pertanyaan FAQ' : 'Tambah Pertanyaan FAQ Baru'}
                </h3>
              </div>
              <button onClick={() => setFaqItemModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFaqItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Kategori FAQ *</label>
                <select
                  value={faqItemForm.category_id}
                  onChange={(e) => setFaqItemForm({ ...faqItemForm, category_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  {faqCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Pertanyaan (Question) *</label>
                <input
                  type="text"
                  required
                  value={faqItemForm.question}
                  onChange={(e) => setFaqItemForm({ ...faqItemForm, question: e.target.value })}
                  placeholder="Misal: Apakah hak cipta lagu tetap milik saya?"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Jawaban (Answer) *</label>
                <textarea
                  rows={4}
                  required
                  value={faqItemForm.answer}
                  onChange={(e) => setFaqItemForm({ ...faqItemForm, answer: e.target.value })}
                  placeholder="Jawaban lengkap dan jelas..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Urutan Accordion</label>
                  <input
                    type="number"
                    min="1"
                    value={faqItemForm.display_order}
                    onChange={(e) => setFaqItemForm({ ...faqItemForm, display_order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Status</label>
                  <select
                    value={faqItemForm.status}
                    onChange={(e) => setFaqItemForm({ ...faqItemForm, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setFaqItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-xs font-semibold text-gray-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Simpan FAQ Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SECTION EDIT */}
      {/* ========================================================================= */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14141B] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-white">Edit Landing Section</h3>
              </div>
              <button onClick={() => setEditingSection(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Judul Section *</label>
                <input
                  type="text"
                  required
                  value={sectionForm.title}
                  onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Subjudul / Deskripsi</label>
                <input
                  type="text"
                  value={sectionForm.subtitle}
                  onChange={(e) => setSectionForm({ ...sectionForm, subtitle: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    min="1"
                    value={sectionForm.display_order}
                    onChange={(e) => setSectionForm({ ...sectionForm, display_order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Status</label>
                  <select
                    value={sectionForm.is_enabled ? 'true' : 'false'}
                    onChange={(e) => setSectionForm({ ...sectionForm, is_enabled: e.target.value === 'true' })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0B0B0E] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-400"
                  >
                    <option value="true">Aktif (Tampil)</option>
                    <option value="false">Sembunyikan</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] text-xs font-semibold text-gray-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Simpan Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14141B] border border-rose-500/30 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Konfirmasi Hapus</h3>
              <p className="text-xs text-gray-400 mt-1">
                Apakah Anda yakin ingin menghapus <span className="text-white font-semibold">{deleteConfirm.title}</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm({ open: false, type: 'testimonial', id: '', title: '' })}
                className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-gray-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-[0_4px_14px_rgba(225,29,72,0.4)] cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
