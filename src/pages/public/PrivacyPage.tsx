import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-gray-300">
      <div className="flex items-center gap-3 mb-4 text-indigo-400">
        <Shield className="w-6 h-6" />
        <span className="text-xs font-bold tracking-widest uppercase">Kebijakan Privasi</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">Privacy Policy</h1>
      <p className="text-xs text-gray-500 mb-10 pb-6 border-b border-white/[0.08]">Terakhir diperbarui: 14 Oktober 2026</p>

      <div className="space-y-8 text-sm leading-relaxed">
        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">1. Pengantar</h2>
          <p className="text-gray-400">
            Breakout Music berkomitmen penuh untuk melindungi privasi data pribadi, metadata musik, data perbankan, dan laporan royalti dari setiap artis dan label yang menggunakan platform distribusi kami.
          </p>
        </section>

        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">2. Data yang Dikumpulkan</h2>
          <p className="text-gray-400 mb-3">Kami mengumpulkan informasi yang diperlukan untuk verifikasi identitas (KYC) dan distribusi musik global:</p>
          <ul className="list-disc list-inside space-y-1.5 text-gray-400 ml-2">
            <li>Identitas Akun: Nama lengkap, alamat email terdaftar, dan nomor telepon aktif.</li>
            <li>Identitas Legal &amp; KYC: Nomor Induk Kependudukan (NIK) atau nomor identitas resmi untuk penarikan royalti.</li>
            <li>Metadata Musik: Nama artis panggung, judul lagu, lirik, kode ISRC, kode UPC/EAN, dan berkas master audio (.wav/.mp3).</li>
            <li>Data Rekening Payout: Nomor rekening bank nasional (BCA, Mandiri, BNI, BRI) atau e-wallet (GoPay, OVO, Dana) untuk transfer royalti.</li>
          </ul>
        </section>

        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">3. Keamanan &amp; Perlindungan Data</h2>
          <p className="text-gray-400">
            Semua transmisi data dienkripsi dengan standar TLS 1.3, autentikasi terverifikasi melalui JWT bersertifikasi, serta penyimpanan aset audio dan artwork aman di Cloudflare R2 dengan proteksi hak cipta.
          </p>
        </section>

        <section className="bg-[#14141B] border border-white/[0.06] p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white mb-3">4. Kontak Bantuan</h2>
          <p className="text-gray-400">
            Pertanyaan seputar privasi atau permintaan penghapusan data dapat disampaikan ke tim kepatuhan resmi di <span className="text-indigo-400 font-medium">privacy@breakoutmusic.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
