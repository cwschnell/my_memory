import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;
import 'screens/record_screen.dart';
import 'screens/list_screen.dart';
import 'screens/shopping_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/guest_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';
import 'config.dart';

void main() {
  runApp(const MyMemoryApp());
}

class MyMemoryApp extends StatelessWidget {
  const MyMemoryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My Memory',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1E3A8A)),
        useMaterial3: true,
      ),
      home: const AuthGuard(),
    );
  }
}

class AuthGuard extends StatefulWidget {
  const AuthGuard({super.key});
  @override
  State<AuthGuard> createState() => _AuthGuardState();
}

class _AuthGuardState extends State<AuthGuard> {
  bool _checking = true;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    setState(() {
      _loggedIn = token != null && token.isNotEmpty;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFF1E3A8A))));
    }
    if (!_loggedIn) {
      return LoginScreen(onLoginSuccess: () => setState(() => _loggedIn = true));
    }
    return MainNav(onLogout: () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('auth_token');
      await prefs.remove('auth_email');
      await prefs.remove('auth_role');
      await prefs.remove('active_lodge_id');
      await prefs.remove('active_lodge_name');
      setState(() => _loggedIn = false);
    });
  }
}

class MainNav extends StatefulWidget {
  final VoidCallback onLogout;
  const MainNav({super.key, required this.onLogout});
  @override
  State<MainNav> createState() => _MainNavState();
}

class _MainNavState extends State<MainNav> {
  int _currentIndex = 0;
  bool _updateAvailable = false;
  String _apkUrl = '';

  List<Map<String, dynamic>> _lodgesList = [];
  String? _activeLodgeId;
  String _activeLodgeName = '';

  List<Widget> get _screens => [
    RecordScreen(key: ValueKey(_activeLodgeId)),
    ListScreen(key: ValueKey(_activeLodgeId)),
    ShoppingScreen(key: ValueKey(_activeLodgeId)),
    CalendarScreen(key: ValueKey(_activeLodgeId)),
    GuestScreen(key: ValueKey(_activeLodgeId)),
  ];

  @override
  void initState() {
    super.initState();
    _loadLodgeData();
    _checkForUpdates();
  }

  Future<void> _loadLodgeData() async {
    final prefs = await SharedPreferences.getInstance();
    final email = prefs.getString('auth_email') ?? '';
    final activeId = prefs.getString('active_lodge_id') ?? '';
    final activeName = prefs.getString('active_lodge_name') ?? 'Default Lodge';

    setState(() {
      _activeLodgeId = activeId;
      _activeLodgeName = activeName;
    });

    try {
      final uri = Uri.parse('$BASE_URL/auth/lodges?email=${Uri.encodeComponent(email)}');
      final resp = await http.get(uri);
      if (resp.statusCode == 200) {
        final List list = json.decode(resp.body);
        if (mounted) {
          setState(() {
            _lodgesList = list.map((e) => Map<String, dynamic>.from(e)).toList();
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _switchLodge(String id) async {
    final name = _lodgesList.firstWhere((l) => l['id'] == id)['name'] ?? 'Default Lodge';
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('active_lodge_id', id);
    await prefs.setString('active_lodge_name', name);
    setState(() {
      _activeLodgeId = id;
      _activeLodgeName = name;
    });
  }

  Future<void> _checkForUpdates() async {
    try {
      final res = await ApiService.getLatestUpdate('6.0.0');
      if (res['update_available'] == true && res['apk_url'] != null) {
        String url = res['apk_url'];
        if (url.startsWith('/')) {
          url = '$BASE_URL$url';
        }
        if (mounted) {
          setState(() {
            _updateAvailable = true;
            _apkUrl = url;
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _launchUpdate() async {
    final targetUrl = _apkUrl.isNotEmpty ? _apkUrl : '$BASE_URL/updates/download';
    final uri = Uri.parse(targetUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Thin global lodge selection status header
          SafeArea(
            bottom: false,
            child: Container(
              color: const Color(0xFF1E293B),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        const Icon(Icons.holiday_village, color: Color(0xFF38BDF8), size: 18),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Active: $_activeLodgeName',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_lodgesList.isNotEmpty)
                    DropdownButton<String>(
                      value: _activeLodgeId,
                      dropdownColor: const Color(0xFF1E293B),
                      icon: const Icon(Icons.swap_horiz, color: Color(0xFF38BDF8), size: 18),
                      underline: Container(),
                      style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 12),
                      onChanged: (id) {
                        if (id != null) _switchLodge(id);
                      },
                      items: _lodgesList.map((l) {
                        return DropdownMenuItem<String>(
                          value: l['id'],
                          child: Text(l['name']),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ),
          Expanded(child: _screens[_currentIndex]),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFF1E293B),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _updateAvailable ? '🎉 New App Update Available!' : '📲 App Version: 6.0.0',
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _updateAvailable ? const Color(0xFF16A34A) : const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  ),
                  onPressed: _launchUpdate,
                  icon: const Icon(Icons.download, size: 16, color: Colors.white),
                  label: Text(
                    _updateAvailable ? 'Update Now' : 'Download Latest',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                )
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: const Color(0xFF1E3A8A),
        unselectedItemColor: Colors.grey,
        type: BottomNavigationBarType.fixed,
        onTap: (i) {
          if (i == 5) {
            widget.onLogout();
          } else {
            setState(() => _currentIndex = i);
          }
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.mic), label: 'Record'),
          BottomNavigationBarItem(icon: Icon(Icons.list_alt), label: 'Memos'),
          BottomNavigationBarItem(icon: Icon(Icons.shopping_cart), label: 'Shopping'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month), label: 'Calendar'),
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Guests'),
          BottomNavigationBarItem(icon: Icon(Icons.logout, color: Colors.redAccent), label: 'Logout'),
        ],
      ),
    );
  }
}
