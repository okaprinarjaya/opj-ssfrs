README
======

Opj-Ssfrs adalah sebuah file-receive server berbasis TCP yang amat sangat sederhana yang ditulis dengan NodeJS. Seperti halnya server-server TCP yang lain, Opj-Ssfrs memiliki design protocolnya sendiri. Dan tentunya Opj-Ssfrs tidak lupa untuk memenuhi kodratnya sebagai server komunikasi data yaitu mencatat dan menyediakan informasi yang detail tentang status proses transfer data.Semuanya tercatat dalam database MongoDB dan ya, Opj-Ssfrs sangat tight (lekat) dengan MongoDB.

Di alam liar di luar sana, Opj-Ssfrs menyadari betapa terbatas kemampuannya. Opj-Ssfrs juga ingin membantu anda lebih banyak, yaitu membantu anda melakukan proses-proses selanjutnya saat file yang anda kirim telah diterima dan tentunya proses-proses itu tidak sedikit jenisnya. Oleh karena itu Opj-Ssfrs menyediakan mekanisme integrasi dengan job server bernama Gearman. Gearman dengan senang hati melakukan semua pekerjaan pemrosesan komputasi anda bersama para workernya. Ya, Gearman lah yang menyelesaikan proses-proses anda selanjutnya, bukan Opj-Ssfrs, Opj-Ssfrs hanya menyediakan mekanisme integrasi saja.

Requirements
------------
1. NodeJS
2. MongoDB
3. Gearman (Optional)
4. Visual Studio 2010 Express Edition (Wajib. Khusus untuk penggunaan di lingkungan Microsoft Windows)

Instalasi
---------
Nyalakan server MongoDB terlebih dahulu. Pastikan Server MongoDB sudah running dengan baik.

Lalu clone repository 

    git clone https://github.com/okaprinarjaya/opj-ssfrs.git

Masuk ke direktori opj-ssfrs

    cd opj-ssfrs

Susunan direktori opj-ssfrs adalah sebagai berikut

    opj-ssfrs
    -- server
    ---- server.js
    ---- server_utils.js
    ---- config.js
    -- client
    ---- Opj_Ssfrc.js
    ---- test_client.js
    ---- test_client_multipart.js

Lalu lanjutkan dengan menginstall semua dependency

    npm install

Setelah semua dependency terinstall, lanjutkan dengan mengkonfigurasi file `opj-ssfrs/server/config.js`

Jika sudah terkonfigurasi dengan benar, pastikan anda berada di direktori `opj-ssfrs/` lalu jalankan server dengan perintah

    node server/server.js

Buka window shell terminal baru untuk mengetest mengirim file ke server masuk ke direktori `opj-ssfrs/client/`.
Lanjutkan dengan menyesuaikan beberapa baris code dari file `test_client.js` . 

    var filePath = 'C:\\Users\\oka\\Documents\\ASUS\\'; <<-- adalah direktori lokasi semua file yg akan dikirim

Test kirim file dengan perintah

    node test_client.js nama_file_yg_ada_di_var_filePath.ext [enter]



