import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';
import '../config.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoginSuccess;

  const LoginScreen({super.key, required this.onLoginSuccess});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _pinCtrl = TextEditingController();

  // Lodge config controllers
  final List<TextEditingController> _lodgeCtrls = List.generate(5, (_) => TextEditingController());

  bool _isRegistering = false;
  bool _loading = false;
  String? _errorMessage;
  String? _successMessage;

  // Post-auth temp states
  bool _showLodgeSetup = false;
  String _tempToken = '';
  String _tempEmail = '';
  String _tempRole = '';
  List<Map<String, dynamic>> _lodgesList = [];
  String? _selectedLodgeId;

  Future<void> _loadLodges(String email) async {
    try {
      final uri = Uri.parse('$BASE_URL/auth/lodges?email=${Uri.encodeComponent(email)}');
      final resp = await http.get(uri);
      if (resp.statusCode == 200) {
        final List list = json.decode(resp.body);
        setState(() {
          _lodgesList = list.map((e) => Map<String, dynamic>.from(e)).toList();
          for (int i = 0; i < 5; i++) {
            _lodgeCtrls[i].text = (i < _lodgesList.length) ? _lodgesList[i]['name'] : '';
          }
          if (_lodgesList.isNotEmpty) {
            _selectedLodgeId = _lodgesList[0]['id'];
          }
          _showLodgeSetup = true;
        });
      }
    } catch (e) {
      setState(() => _errorMessage = 'Failed to load lodges: $e');
    }
  }

  Future<void> _handleSignIn() async {
    final email = _emailCtrl.text.trim();
    final pin = _pinCtrl.text.trim();

    if (email.isEmpty || !email.contains('@')) {
      setState(() => _errorMessage = 'Please enter a valid email address.');
      return;
    }
    if (pin.length < 4) {
      setState(() => _errorMessage = 'Please enter your 4 to 6 digit PIN.');
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final res = await ApiService.verifyPin(email, pin);
      _tempToken = res['token'];
      _tempEmail = res['email'];
      _tempRole = res['role'] ?? 'user';

      await _loadLodges(_tempEmail);
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleRegister() async {
    final email = _emailCtrl.text.trim();
    final pin = _pinCtrl.text.trim();

    if (email.isEmpty || !email.contains('@')) {
      setState(() => _errorMessage = 'Please enter a valid email address.');
      return;
    }
    if (pin.length < 4 || pin.length > 20) {
      setState(() => _errorMessage = 'Please choose a PIN between 4 and 6 digits.');
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final res = await ApiService.registerUser(email, pin);
      _tempToken = res['token'];
      _tempEmail = res['email'];
      _tempRole = res['role'] ?? 'user';

      setState(() {
        _successMessage = 'Account successfully registered! Loading lodges...';
      });

      await _loadLodges(_tempEmail);
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleSyncLodges() async {
    final names = _lodgeCtrls.map((c) => c.text.trim()).where((t) => t.isNotEmpty).toList();
    if (names.isEmpty) {
      setState(() => _errorMessage = 'Please configure at least one lodge.');
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final uri = Uri.parse('$BASE_URL/auth/lodges/sync');
      final resp = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': _tempEmail,
          'names': names,
        }),
      );

      if (resp.statusCode == 200) {
        final List list = json.decode(resp.body);
        setState(() {
          _lodgesList = list.map((e) => Map<String, dynamic>.from(e)).toList();
          for (int i = 0; i < 5; i++) {
            _lodgeCtrls[i].text = (i < _lodgesList.length) ? _lodgesList[i]['name'] : '';
          }
          if (_lodgesList.isNotEmpty) {
            _selectedLodgeId = _lodgesList[0]['id'];
          }
          _successMessage = 'Lodge list synced successfully!';
        });
      } else {
        throw Exception(resp.body);
      }
    } catch (e) {
      setState(() => _errorMessage = 'Sync failed: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleEnterApp() async {
    if (_selectedLodgeId == null) {
      setState(() => _errorMessage = 'Please select a lodge to manage.');
      return;
    }

    final activeLodgeName = _lodgesList.firstWhere((l) => l['id'] == _selectedLodgeId)['name'] ?? 'Default Lodge';

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', _tempToken);
    await prefs.setString('auth_email', _tempEmail);
    await prefs.setString('auth_role', _tempRole);
    await prefs.setString('active_lodge_id', _selectedLodgeId!);
    await prefs.setString('active_lodge_name', activeLodgeName);

    widget.onLoginSuccess();
  }

  @override
  Widget build(BuildContext context) {
    if (_showLodgeSetup) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B82F6).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.holiday_village, size: 60, color: Color(0xFF3B82F6)),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Manage & Select Lodges',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF3B82F6)),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Configure up to 5 lodges and select one to manage.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),

                if (_errorMessage != null)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade900.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade800),
                    ),
                    child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
                  ),

                if (_successMessage != null)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.shade900.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.green.shade800),
                    ),
                    child: Text(_successMessage!, style: const TextStyle(color: Colors.greenAccent, fontSize: 13)),
                  ),

                // 5 lodge input boxes
                ...List.generate(5, (idx) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: TextField(
                      controller: _lodgeCtrls[idx],
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Lodge ${idx + 1} Name',
                        labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        filled: true,
                        fillColor: const Color(0xFF1E293B),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  );
                }),

                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _loading ? null : _handleSyncLodges,
                    child: _loading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Save & Sync Lodges', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                  ),
                ),

                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(color: Color(0xFF334155)),
                ),

                // Lodge Dropdown Selector
                if (_lodgesList.isNotEmpty) ...[
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Select Active Lodge', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedLodgeId,
                        dropdownColor: const Color(0xFF1E293B),
                        iconEnabledColor: const Color(0xFF3B82F6),
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                        isExpanded: true,
                        onChanged: (id) => setState(() => _selectedLodgeId = id),
                        items: _lodgesList.map((l) {
                          return DropdownMenuItem<String>(
                            value: l['id'],
                            child: Text(l['name']),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _loading ? null : _handleEnterApp,
                    child: const Text('Enter App 🚀', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B82F6).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.lock_person, size: 60, color: Color(0xFF3B82F6)),
              ),
              const SizedBox(height: 20),
              const Text(
                'My Memory App',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Color(0xFF3B82F6)),
              ),
              const SizedBox(height: 6),
              Text(
                _isRegistering ? 'Register your permanent email & 6-digit PIN' : 'Sign in with your email and PIN',
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
              ),
              const SizedBox(height: 24),

              // Mode selector tabs
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _isRegistering = false;
                          _errorMessage = null;
                          _successMessage = null;
                        }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: !_isRegistering ? const Color(0xFF0F172A) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            'Sign In',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: !_isRegistering ? const Color(0xFF3B82F6) : const Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _isRegistering = true;
                          _errorMessage = null;
                          _successMessage = null;
                        }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _isRegistering ? const Color(0xFF0F172A) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            'Register New',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: _isRegistering ? const Color(0xFF059669) : const Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              if (_errorMessage != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade900.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade800),
                  ),
                  child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
                ),

              if (_successMessage != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.shade900.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.shade800),
                  ),
                  child: Text(_successMessage!, style: const TextStyle(color: Colors.greenAccent, fontSize: 13)),
                ),

              TextField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Email Address',
                  labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                  prefixIcon: const Icon(Icons.email_outlined, color: Color(0xFF94A3B8)),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 16),

              TextField(
                controller: _pinCtrl,
                obscureText: !_isRegistering,
                maxLength: 12,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 18, letterSpacing: 4, fontWeight: FontWeight.bold, color: Colors.white),
                decoration: InputDecoration(
                  labelText: _isRegistering ? 'Choose 6-Digit PIN' : 'Your PIN',
                  counterText: '',
                  prefixIcon: const Icon(Icons.key_outlined, color: Color(0xFF94A3B8)),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: const Color(0xFF1E293B),
                ),
              ),
              if (_isRegistering)
                const Padding(
                  padding: EdgeInsets.only(top: 6, left: 4),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'This PIN will be permanently saved to your account.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    ),
                  ),
                ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isRegistering ? const Color(0xFF059669) : const Color(0xFF3B82F6),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _loading ? null : (_isRegistering ? _handleRegister : _handleSignIn),
                  child: _loading
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(
                          _isRegistering ? 'Register Account' : 'Sign In',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
