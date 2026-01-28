package moe.shizuku.api;
interface IShizukuService {
    int getVersion() = 0;
    int checkPermission(String permission) = 1;
}
