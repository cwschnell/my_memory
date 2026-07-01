import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'screens/record_screen.dart';
import 'screens/list_screen.dart';
import 'screens/shopping_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';

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

  final List<Widget> _screens = const [
    RecordScreen(),
    ListScreen(),
    ShoppingScreen(),
    CalendarScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _checkForUpdates();
  }

  Future<void> _checkForUpdates() async {
    try {
      final res = await ApiService.getLatestUpdate('1.0.0');
      if (res['update_available'] == true && res['apk_url'] != null) {
        if (mounted) {
          setState(() {
            _updateAvailable = true;
            _apkUrl = res['apk_url'];
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _launchUpdate() async {
    if (_apkUrl.isNotEmpty) {
      final uri = Uri.parse(_apkUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Expanded(child: _screens[_currentIndex]),
          if (_updateAvailable)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFF16A34A),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('🎉 New App Update Available!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF16A34A),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    ),
                    onPressed: _launchUpdate,
                    child: const Text('Update Now', style: TextStyle(fontWeight: FontWeight.bold)),
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
          if (i == 4) {
            // Logout tapped
            widget.onLogout();
          } else {
            setState(() => _currentIndex = i);
          }
        },
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.mic), label: 'Record'),
          const BottomNavigationBarItem(icon: Icon(Icons.list_alt), label: 'Memos'),
          const BottomNavigationBarItem(icon: Icon(Icons.shopping_cart), label: 'Shopping'),
          const BottomNavigationBarItem(icon: Icon(Icons.calendar_month), label: 'Calendar'),
          const BottomNavigationBarItem(icon: Icon(Icons.logout, color: Colors.redAccent), label: 'Logout'),
        ],
      ),
    );
  }
}
