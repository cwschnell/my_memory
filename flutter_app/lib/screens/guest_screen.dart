import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/passport_service.dart';
import '../config.dart';

// ─────────────────────────────────────────────────────────────
// DATA MODEL
// ─────────────────────────────────────────────────────────────
class GuestModel {
  final String id;
  final String fullName;
  final String? nationality;
  final String? passportNumber;
  final String? idNumber;
  final String? dateOfBirth;
  final String? dateOfIssue;
  final String? dateOfExpiry;
  final String? issuingAuthority;
  final String? placeOfBirth;
  final String? phone;
  final String? email;
  final String? notes;
  final String? userEmail;
  final bool hasPassportImage;

  GuestModel({
    required this.id,
    required this.fullName,
    this.nationality,
    this.passportNumber,
    this.idNumber,
    this.dateOfBirth,
    this.dateOfIssue,
    this.dateOfExpiry,
    this.issuingAuthority,
    this.placeOfBirth,
    this.phone,
    this.email,
    this.notes,
    this.userEmail,
    this.hasPassportImage = false,
  });

  factory GuestModel.fromJson(Map<String, dynamic> j) => GuestModel(
    id:               j['id'] ?? '',
    fullName:         j['full_name'] ?? '',
    nationality:      j['nationality'],
    passportNumber:   j['passport_number'],
    idNumber:         j['id_number'],
    dateOfBirth:      j['date_of_birth'],
    dateOfIssue:      j['date_of_issue'],
    dateOfExpiry:     j['date_of_expiry'],
    issuingAuthority: j['issuing_authority'],
    placeOfBirth:     j['place_of_birth'],
    phone:            j['phone'],
    email:            j['email'],
    notes:            j['notes'],
    userEmail:        j['user_email'],
    hasPassportImage: j['has_passport_image'] == true,
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────
class GuestScreen extends StatefulWidget {
  const GuestScreen({super.key});
  @override
  State<GuestScreen> createState() => _GuestScreenState();
}

class _GuestScreenState extends State<GuestScreen> {
  List<GuestModel> _guests = [];
  bool _loading = true;
  String? _token;
  DateTime? _selectedFilterDate;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    await _loadGuests();
  }

  Future<void> _loadGuests() async {
    setState(() => _loading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final lodgeId = prefs.getString('active_lodge_id') ?? '';
      
      final Map<String, String> headers = {
        'Authorization': 'Bearer $_token',
      };
      if (lodgeId.isNotEmpty) {
        headers['X-Lodge-Id'] = lodgeId;
      }

      if (_selectedFilterDate != null) {
        final dateStr = '${_selectedFilterDate!.year}-${_selectedFilterDate!.month.toString().padLeft(2, '0')}-${_selectedFilterDate!.day.toString().padLeft(2, '0')}';
        final resp = await http.get(
          Uri.parse('$BASE_URL/passport/search?date=$dateStr'),
          headers: headers,
        );
        if (resp.statusCode == 200) {
          final list = json.decode(resp.body) as List;
          setState(() => _guests = list.map((e) => GuestModel.fromJson(e)).toList());
        }
      } else {
        final resp = await http.get(
          Uri.parse('$BASE_URL/lodge/guests'),
          headers: headers,
        );
        if (resp.statusCode == 200) {
          final list = json.decode(resp.body) as List;
          setState(() => _guests = list.map((e) => GuestModel.fromJson(e)).toList());
        }
      }
    } catch (e) {
      debugPrint('Load guests error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _clearFilterDate() {
    setState(() => _selectedFilterDate = null);
    _loadGuests();
  }

  void _openNewGuestForm({GuestModel? prefilled, File? passportImage}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => GuestFormSheet(
        token: _token,
        prefilled: prefilled,
        passportImageFile: passportImage,
        onSaved: _loadGuests,
      ),
    );
  }

  Future<void> _selectFilterDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedFilterDate ?? DateTime.now(),
      firstDate: DateTime(2025),
      lastDate: DateTime(2035),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF3B82F6),
            onPrimary: Colors.white,
            surface: Color(0xFF1E293B),
            onSurface: Colors.white,
          ),
          dialogBackgroundColor: const Color(0xFF0F172A),
        ),
        child: child!,
      ),
    );

    if (picked != null) {
      setState(() => _selectedFilterDate = picked);
      _loadGuests();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Guests', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1E3A8A),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          if (_selectedFilterDate != null)
            IconButton(
              icon: const Icon(Icons.clear, color: Colors.redAccent),
              onPressed: _clearFilterDate,
              tooltip: 'Clear Date Filter',
            ),
          IconButton(
            icon: const Icon(Icons.date_range, color: Colors.white),
            onPressed: _selectFilterDate,
            tooltip: 'Filter by Date',
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _loadGuests,
          ),
        ],
      ),
      body: Column(
        children: [
          if (_selectedFilterDate != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              color: const Color(0xFF1E293B),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Filtering reservations active on: ${_selectedFilterDate!.year}-${_selectedFilterDate!.month.toString().padLeft(2, '0')}-${_selectedFilterDate!.day.toString().padLeft(2, '0')}',
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  GestureDetector(
                    onTap: _clearFilterDate,
                    child: const Text('Clear', style: TextStyle(color: Color(0xFF3B82F6), fontWeight: FontWeight.bold)),
                  )
                ],
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF3B82F6)))
                : _guests.isEmpty
                     ? _emptyState()
                     : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _guests.length,
                          itemBuilder: (_, i) => _GuestCard(
                            guest: _guests[i],
                            onEdit: () => _openNewGuestForm(prefilled: _guests[i]),
                          ),
                       ),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.extended(
            heroTag: 'scan',
            onPressed: _scanPassport,
            backgroundColor: const Color(0xFF059669),
            icon: const Icon(Icons.document_scanner, color: Colors.white),
            label: const Text('Scan Passport', style: TextStyle(color: Colors.white)),
          ),
          const SizedBox(height: 10),
          FloatingActionButton(
            heroTag: 'add',
            onPressed: () => _openNewGuestForm(),
            backgroundColor: const Color(0xFF1E3A8A),
            child: const Icon(Icons.person_add, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _emptyState() => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.people_outline, size: 64, color: Color(0xFF475569)),
        const SizedBox(height: 12),
        const Text('No guests found', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 18)),
        const SizedBox(height: 8),
        const Text('Tap "Scan Passport" to add a guest instantly',
            style: TextStyle(color: Color(0xFF64748B))),
      ],
    ),
  );

  Future<void> _scanPassport() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 90,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (picked == null) return;

    final file = File(picked.path);

    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AlertDialog(
        backgroundColor: Color(0xFF1E293B),
        content: Row(children: [
          CircularProgressIndicator(color: Color(0xFF3B82F6)),
          SizedBox(width: 16),
          Text('Reading passport...', style: TextStyle(color: Colors.white)),
        ]),
      ),
    );

    try {
      final service = PassportService(
        token: _token,
      );
      final result = await service.scanPassport(file);

      if (!mounted) return;
      Navigator.pop(context); // close loading dialog

      // Convert OCR result to a prefilled GuestModel (no id yet)
      final prefilled = GuestModel(
        id: '',
        fullName:         result.fullName ?? '',
        nationality:      result.nationality,
        passportNumber:   result.passportNumber,
        idNumber:         result.idNumber,
        dateOfBirth:      result.dateOfBirth,
        dateOfIssue:      result.dateOfIssue,
        dateOfExpiry:     result.dateOfExpiry,
        issuingAuthority: result.issuingAuthority,
        placeOfBirth:     result.placeOfBirth,
      );

      _openNewGuestForm(prefilled: prefilled, passportImage: file);
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Scan failed: $e'),
          backgroundColor: Colors.red[700],
        ),
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────
// GUEST CARD
// ─────────────────────────────────────────────────────────────
class _GuestCard extends StatelessWidget {
  final GuestModel guest;
  final VoidCallback onEdit;
  const _GuestCard({required this.guest, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF1E293B),
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFF1E3A8A),
          child: Text(
            guest.fullName.isNotEmpty ? guest.fullName[0].toUpperCase() : '?',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(guest.fullName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (guest.nationality != null)
              Text(guest.nationality!, style: const TextStyle(color: Color(0xFF94A3B8))),
            if (guest.passportNumber != null)
              Text('PP: ${guest.passportNumber}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
            if (guest.dateOfExpiry != null)
              Text('Expires: ${guest.dateOfExpiry}', style: TextStyle(
                color: _isExpirySoon(guest.dateOfExpiry!) ? Colors.orange : const Color(0xFF64748B),
                fontSize: 12,
              )),
            if (guest.userEmail != null && guest.userEmail!.isNotEmpty)
              Text('Scanned by: ${guest.userEmail}', style: const TextStyle(color: Color(0xFF475569), fontSize: 11)),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (guest.hasPassportImage)
              const Icon(Icons.photo_camera, color: Color(0xFF059669), size: 18),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.edit, color: Color(0xFF3B82F6), size: 20),
              onPressed: onEdit,
              tooltip: 'Edit Profile',
            ),
          ],
        ),
      ),
    );
  }

  bool _isExpirySoon(String dateStr) {
    try {
      final expiry = DateTime.parse(dateStr);
      return expiry.difference(DateTime.now()).inDays < 90;
    } catch (_) {
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// GUEST FORM SHEET
// ─────────────────────────────────────────────────────────────
class GuestFormSheet extends StatefulWidget {
  final String? token;
  final GuestModel? prefilled;
  final File? passportImageFile;
  final VoidCallback onSaved;

  const GuestFormSheet({
    super.key,
    this.token,
    this.prefilled,
    this.passportImageFile,
    required this.onSaved,
  });

  @override
  State<GuestFormSheet> createState() => _GuestFormSheetState();
}

class _GuestFormSheetState extends State<GuestFormSheet> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  late final TextEditingController _fullName;
  late final TextEditingController _nationality;
  late final TextEditingController _passportNumber;
  late final TextEditingController _idNumber;
  late final TextEditingController _dateOfBirth;
  late final TextEditingController _dateOfIssue;
  late final TextEditingController _dateOfExpiry;
  late final TextEditingController _issuingAuthority;
  late final TextEditingController _placeOfBirth;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _notes;

  // Reservation Check-in/Check-out dates state
  DateTime _checkInDate = DateTime.now();
  DateTime _checkOutDate = DateTime.now().add(const Duration(days: 1));

  @override
  void initState() {
    super.initState();
    final p = widget.prefilled;
    _fullName         = TextEditingController(text: p?.fullName ?? '');
    _nationality      = TextEditingController(text: p?.nationality ?? '');
    _passportNumber   = TextEditingController(text: p?.passportNumber ?? '');
    _idNumber         = TextEditingController(text: p?.idNumber ?? '');
    _dateOfBirth      = TextEditingController(text: p?.dateOfBirth ?? '');
    _dateOfIssue      = TextEditingController(text: p?.dateOfIssue ?? '');
    _dateOfExpiry     = TextEditingController(text: p?.dateOfExpiry ?? '');
    _issuingAuthority = TextEditingController(text: p?.issuingAuthority ?? '');
    _placeOfBirth     = TextEditingController(text: p?.placeOfBirth ?? '');
    _phone            = TextEditingController(text: p?.phone ?? '');
    _email            = TextEditingController(text: p?.email ?? '');
    _notes            = TextEditingController(text: p?.notes ?? '');
  }

  @override
  void dispose() {
    for (final c in [_fullName, _nationality, _passportNumber, _idNumber,
        _dateOfBirth, _dateOfIssue, _dateOfExpiry, _issuingAuthority,
        _placeOfBirth, _phone, _email, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate(bool isCheckIn) async {
    final initialDate = isCheckIn ? _checkInDate : _checkOutDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2025),
      lastDate: DateTime(2035),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF3B82F6),
            onPrimary: Colors.white,
            surface: Color(0xFF1E293B),
            onSurface: Colors.white,
          ),
          dialogBackgroundColor: const Color(0xFF0F172A),
        ),
        child: child!,
      ),
    );

    if (picked != null) {
      setState(() {
        if (isCheckIn) {
          _checkInDate = picked;
          if (_checkOutDate.isBefore(_checkInDate) || _checkOutDate.isAtSameMomentAs(_checkInDate)) {
            _checkOutDate = _checkInDate.add(const Duration(days: 1));
          }
        } else {
          _checkOutDate = picked;
        }
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final prefs = await SharedPreferences.getInstance();
    final authEmail = prefs.getString('auth_email') ?? '';
    final lodgeId = prefs.getString('active_lodge_id') ?? '';

    final checkInStr = '${_checkInDate.year}-${_checkInDate.month.toString().padLeft(2, '0')}-${_checkInDate.day.toString().padLeft(2, '0')}';
    final checkOutStr = '${_checkOutDate.year}-${_checkOutDate.month.toString().padLeft(2, '0')}-${_checkOutDate.day.toString().padLeft(2, '0')}';

    try {
      final body = json.encode({
        'full_name':         _fullName.text.trim(),
        'nationality':       _nationality.text.trim().isEmpty ? null : _nationality.text.trim(),
        'passport_number':   _passportNumber.text.trim().isEmpty ? null : _passportNumber.text.trim(),
        'id_number':         _idNumber.text.trim().isEmpty ? null : _idNumber.text.trim(),
        'date_of_birth':     _dateOfBirth.text.trim().isEmpty ? null : _dateOfBirth.text.trim(),
        'date_of_issue':     _dateOfIssue.text.trim().isEmpty ? null : _dateOfIssue.text.trim(),
        'date_of_expiry':    _dateOfExpiry.text.trim().isEmpty ? null : _dateOfExpiry.text.trim(),
        'issuing_authority': _issuingAuthority.text.trim().isEmpty ? null : _issuingAuthority.text.trim(),
        'place_of_birth':    _placeOfBirth.text.trim().isEmpty ? null : _placeOfBirth.text.trim(),
        'phone':             _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'email':             _email.text.trim().isEmpty ? null : _email.text.trim(),
        'notes':             _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'user_email':        authEmail,
        'check_in':          checkInStr,
        'check_out':         checkOutStr,
      });

      final Map<String, String> headers = {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      };
      if (lodgeId.isNotEmpty) {
        headers['X-Lodge-Id'] = lodgeId;
      }

      final isEditing = widget.prefilled != null && widget.prefilled!.id.isNotEmpty;
      final url = isEditing
          ? '$BASE_URL/lodge/guests/${widget.prefilled!.id}'
          : '$BASE_URL/lodge/guests';

      final resp = await (isEditing
          ? http.put(Uri.parse(url), headers: headers, body: body)
          : http.post(Uri.parse(url), headers: headers, body: body));

      if (resp.statusCode != 200 && resp.statusCode != 201) {
        throw Exception('Save failed: ${resp.body}');
      }

      final guestId = (json.decode(resp.body) as Map)['id'] as String;

      // Upload passport image if we have one
      if (widget.passportImageFile != null) {
        final service = PassportService(
          token: widget.token,
        );
        await service.uploadPassportImage(guestId, widget.passportImageFile!);
      }

      if (!mounted) return;
      Navigator.pop(context);
      widget.onSaved();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Guest & Reservation saved ✓'), backgroundColor: Color(0xFF059669)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red[700]),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String label, TextEditingController ctrl, {bool required = false, TextInputType? keyboard}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboard,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
          filled: true,
          fillColor: const Color(0xFF0F172A),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        ),
        validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPrefilled = widget.prefilled != null;
    final isEditing = isPrefilled && widget.prefilled!.id.isNotEmpty;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.92,
      maxChildSize: 0.97,
      builder: (_, scrollCtrl) => SingleChildScrollView(
        controller: scrollCtrl,
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 40, height: 4,
                  decoration: BoxDecoration(color: const Color(0xFF475569), borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              Row(children: [
                const Icon(Icons.person_add, color: Color(0xFF3B82F6)),
                const SizedBox(width: 8),
                Text(
                  isEditing 
                      ? 'Edit Guest Profile' 
                      : (isPrefilled ? 'New Guest — Passport Scanned ✓' : 'New Guest Profile'),
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ]),
              if (isPrefilled && !isEditing) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF065F46),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(children: [
                    Icon(Icons.check_circle, color: Color(0xFF34D399), size: 16),
                    SizedBox(width: 6),
                    Text('Fields pre-filled from passport scan. Please verify before saving.',
                        style: TextStyle(color: Color(0xFF34D399), fontSize: 12)),
                  ]),
                ),
              ],
              const SizedBox(height: 20),
              const _SectionLabel('IDENTITY'),
              _field('Full Name *', _fullName, required: true),
              _field('Nationality', _nationality),
              _field('Passport Number', _passportNumber),
              _field('National ID Number', _idNumber),
              const _SectionLabel('PASSPORT DETAILS'),
              _field('Date of Birth (YYYY-MM-DD)', _dateOfBirth, keyboard: TextInputType.datetime),
              _field('Date of Issue (YYYY-MM-DD)', _dateOfIssue, keyboard: TextInputType.datetime),
              _field('Date of Expiry (YYYY-MM-DD)', _dateOfExpiry, keyboard: TextInputType.datetime),
              _field('Issuing Authority', _issuingAuthority),
              _field('Place / Country of Birth', _placeOfBirth),
              const _SectionLabel('CONTACT'),
              _field('Phone', _phone, keyboard: TextInputType.phone),
              _field('Email', _email, keyboard: TextInputType.emailAddress),

              const _SectionLabel('RESERVATION DATES'),
              Row(
                children: [
                  Expanded(
                    child: ListTile(
                      title: const Text('Check-In', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      subtitle: Text(
                        '${_checkInDate.year}-${_checkInDate.month.toString().padLeft(2, '0')}-${_checkInDate.day.toString().padLeft(2, '0')}',
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      trailing: const Icon(Icons.calendar_month, color: Color(0xFF3B82F6)),
                      onTap: () => _pickDate(true),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  Expanded(
                    child: ListTile(
                      title: const Text('Check-Out', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      subtitle: Text(
                        '${_checkOutDate.year}-${_checkOutDate.month.toString().padLeft(2, '0')}-${_checkOutDate.day.toString().padLeft(2, '0')}',
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      trailing: const Icon(Icons.calendar_month, color: Color(0xFF3B82F6)),
                      onTap: () => _pickDate(false),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              const _SectionLabel('NOTES'),
              _field('Notes', _notes),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E3A8A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _saving
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Save Guest Profile', style: TextStyle(color: Colors.white, fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 4, bottom: 8),
    child: Text(text, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, letterSpacing: 1.2)),
  );
}
