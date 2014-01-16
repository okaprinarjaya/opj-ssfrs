README
=========

Opj-Ssfrs -> Oka prinarjaya super simple file receive server.

Opj-Ssfrs adalah sebuah file-receive server berbasis TCP yang amat sangat sederhana yang ditulis dengan NodeJS. Seperti halnya server-server TCP yang lain, Opj-Ssfrs memiliki design protocolnya sendiri. Dan tentunya Opj-Ssfrs tidak lupa untuk memenuhi kodratnya sebagai server komunikasi data yaitu mencatat dan menyediakan informasi yang detail tentang status proses transfer data.Semuanya tercatat dalam database MongoDB dan ya, Opj-Ssfrs sangat tight (lekat) dengan MongoDB.

Di alam liar di luar sana, Opj-Ssfrs menyadari betapa terbatas kemampuannya. Opj-Ssfrs juga ingin membantu anda lebih banyak, yaitu membantu anda melakukan proses-proses selanjutnya saat file yang anda kirim telah diterima dan tentunya proses-proses itu tidak sedikit jenisnya. Oleh karena itu Opj-Ssfrs menyediakan mekanisme integrasi dengan job server bernama Gearman. Gearman dengan senang hati melakukan semua pekerjaan pemrosesan komputasi anda bersama para workernya. Ya, Gearman lah yang menyelesaikan proses-proses anda selanjutnya, bukan Opj-Ssfrs, Opj-Ssfrs hanya menyediakan mekanisme integrasi saja.