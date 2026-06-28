import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config.dart';
import '../models/recording.dart';

class ApiService {
  static Future<Recording> uploadAudio(File audioFile) async {
    final uri = Uri.parse('$BASE_URL/recordings/upload');
    final request = http.MultipartRequest('POST', uri);
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

  static Future<Recording> getRecording(String id) async {
    final uri = Uri.parse('$BASE_URL/recordings/$id');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      return Recording.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to load recording');
  }

  static Future<void> updateStatus(String id, String status) async {
    final uri = Uri.parse('$BASE_URL/recordings/$id/status');
    await http.patch(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'status': status}),
    );
  }
}
