import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-gray-300">
      <div className="flex items-center gap-3 mb-4 text-indigo-400">
        <FileText className="w-6 h-6" />
        <span className="text-xs font-bold tracking-widest uppercase">Syarat &amp; Ketentuan</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">Terms of Service</h1>
      <p className="text-xs text-gray-500 mb-10 pb-6 border-b border-white/[0.08]">Terakhir diperbarui: 14 Oktober 2026</p>

      <div className="space-y-8 text-sm leading-relaxed">
        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">1. Kesepakatan Layanan</h2>
          <p className="text-gray-400">
            Dengan mendaftar, mengunggah materi rekaman suara, atau menggunakan platform Breakout Music, Anda menyatakan secara sah bahwa Anda memiliki atau mengontrol seluruh hak cipta atas master rekaman dan komposisi musik yang didistribusikan.
          </p>
        </section>

        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">2. Kepemilikan Master &amp; Royalti (100% Hak Artis)</h2>
          <p className="text-gray-400 mb-2">
            Breakout Music adalah distributor independen non-eksklusif. Anda tetap memegang 100% hak cipta master dan hak kepemilikan intelektual Anda.
          </p>
          <p className="text-gray-400">
            Hasil royalti dari platform streaming digital (DSP) disalurkan secara transparan ke dompet akun Anda tanpa potongan tersembunyi, sesuai dengan laporan CSV resmi dari DSP mitra.
          </p>
        </section>

        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">3. Larangan Streaming Palsu &amp; Pelanggaran Hak Cipta</h2>
          <p className="text-gray-400">
            Penggunaan bot, streaming farming, re-upload karya orang lain tanpa lisensi resmi, atau tindakan manipulatif lainnya dilarang keras. Pelanggaran dapat mengakibatkan penangguhan rilis, pembekuan saldo, dan penutupan akun secara permanen.
          </p>
        </section>

        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">4. Penarikan Saldo &amp; Payout</h2>
          <p className="text-gray-400">
            Penarikan royalti diproses ke rekening bank Indonesia (BCA, Mandiri, BNI, BRI) atau e-wallet resmi setelah pengguna melengkapi verifikasi identitas (KYC) dan saldo memenuhi batas minimum penarikan yang berlaku.
          </p>
        </section>
      </div>
    </div>
  );
}
