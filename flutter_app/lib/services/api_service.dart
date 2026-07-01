import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config.dart';
import '../models/recording.dart';

class ApiService {
  static Future<Recording> uploadAudio({
    required File audioFile,
    required String type,
    String? clientId,
    String? clientName,
  }) async {
    final uri = Uri.parse('$BASE_URL/recordings/upload');
    final request = http.MultipartRequest('POST', uri);
    request.fields['type'] = type;
    if (clientId != null && clientId.isNotEmpty) {
      request.fields['client_id'] = clientId;
    }
    if (clientName != null && clientName.isNotEmpty) {
      request.fields['client_name'] = clientName;
    }
    request.files.add(await http.MultipartFile.fromPath(
      'audio',
      audioFile.path,
      contentType: MediaType('audio', 'm4a'),
    ));
    final response = await request.send();
    final body = await response.stream.bytesToString();
    if (response.statusCode == 201) {
      return Recording.fromJson(jsonDecode(body));
    }
    throw Exception('Upload failed ($response.statusCode): $body');
  }

  static Future<List<Recording>> getByDate(DateTime date) async {
    final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final uri = Uri.parse('$BASE_URL/recordings/by-date/$dateStr');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((j) => Recording.fromJson(j)).toList();
    }
    throw Exception('Failed to load recordings');
  }

  static Future<List<Recording>> getActiveShopping() async {
    final uri = Uri.parse('$BASE_URL/recordings/shopping/active');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((j) => Recording.fromJson(j)).toList();
    }
    throw Exception('Failed to load active shopping list');
  }

  static Future<Map<String, int>> getCalendarDoneCounts() async {
    final uri = Uri.parse('$BASE_URL/recordings/calendar/done-counts');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final Map<String, dynamic> data = jsonDecode(response.body);
      return data.map((k, v) => MapEntry(k, (v as num).toInt()));
    }
    throw Exception('Failed to load calendar counts');
  }

  static Future<List<Recording>> getDoneByDate(DateTime date) async {
    final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final uri = Uri.parse('$BASE_URL/recordings/calendar/done-by-date/$dateStr');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((j) => Recording.fromJson(j)).toList();
    }
    throw Exception('Failed to load done recordings');
  }

  static Future<List<ClientModel>> getClients() async {
    final uri = Uri.parse('$BASE_URL/clients');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((j) => ClientModel.fromJson(j)).toList();
    }
    throw Exception('Failed to load clients');
  }

  static Future<void> updateStatus(String id, String status) async {
    final uri = Uri.parse('$BASE_URL/recordings/$id/status');
    await http.patch(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'status': status}),
    );
  }

  static Future<void> updateDate(String id, DateTime date) async {
    final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final uri = Uri.parse('$BASE_URL/recordings/$id/date');
    await http.patch(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'date_recorded': dateStr}),
    );
  }

  static Future<void> deleteRecording(String id) async {
    final uri = Uri.parse('$BASE_URL/recordings/$id');
    await http.delete(uri);
  }

  static Future<void> sendPin(String email) async {
    final uri = Uri.parse('$BASE_URL/auth/send-pin');
    final res = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    if (res.statusCode != 200) {
      String errorMsg = res.body;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded['detail'] != null) errorMsg = decoded['detail'].toString();
      } catch (_) {}
      throw Exception(errorMsg);
    }
  }

  static Future<Map<String, dynamic>> verifyPin(String email, String pin) async {
    final uri = Uri.parse('$BASE_URL/auth/verify-pin');
    final res = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'pin': pin}),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    String errorMsg = res.body;
    try {
      final decoded = jsonDecode(res.body);
      if (decoded['detail'] != null) errorMsg = decoded['detail'].toString();
    } catch (_) {}
    throw Exception(errorMsg);
  }

  static Future<Map<String, dynamic>> getLatestUpdate(String currentVersion) async {
    final uri = Uri.parse('$BASE_URL/updates/latest?current_version=$currentVersion');
    final res = await http.get(uri);
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    return {'update_available': false, 'apk_url': ''};
  }
}
