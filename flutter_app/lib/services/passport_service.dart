import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config.dart';

class PassportScanResult {
  final String? fullName;
  final String? nationality;
  final String? passportNumber;
  final String? idNumber;
  final String? dateOfBirth;
  final String? dateOfIssue;
  final String? dateOfExpiry;
  final String? issuingAuthority;
  final String? placeOfBirth;
  final String? sex;
  final String? countryCode;

  PassportScanResult({
    this.fullName,
    this.nationality,
    this.passportNumber,
    this.idNumber,
    this.dateOfBirth,
    this.dateOfIssue,
    this.dateOfExpiry,
    this.issuingAuthority,
    this.placeOfBirth,
    this.sex,
    this.countryCode,
  });

  factory PassportScanResult.fromJson(Map<String, dynamic> json) {
    return PassportScanResult(
      fullName:         json['full_name'],
      nationality:      json['nationality'],
      passportNumber:   json['passport_number'],
      idNumber:         json['id_number'],
      dateOfBirth:      json['date_of_birth'],
      dateOfIssue:      json['date_of_issue'],
      dateOfExpiry:     json['date_of_expiry'],
      issuingAuthority: json['issuing_authority'],
      placeOfBirth:     json['place_of_birth'],
      sex:              json['sex'],
      countryCode:      json['country_code'],
    );
  }
}

class PassportService {
  final String? token;

  PassportService({this.token});

  /// Send image to Railway backend for OCR extraction.
  /// Returns extracted fields or throws on failure.
  Future<PassportScanResult> scanPassport(File imageFile) async {
    final uri = Uri.parse('$BASE_URL/passport/scan');
    final request = http.MultipartRequest('POST', uri);

    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final mimeType = imageFile.path.toLowerCase().endsWith('.png')
        ? MediaType('image', 'png')
        : MediaType('image', 'jpeg');

    request.files.add(await http.MultipartFile.fromPath(
      'file',
      imageFile.path,
      contentType: mimeType,
    ));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode != 200) {
      throw Exception('Passport scan failed: ${response.body}');
    }

    final body = json.decode(response.body);
    if (body['success'] != true) {
      throw Exception('OCR extraction failed');
    }

    return PassportScanResult.fromJson(body['data'] as Map<String, dynamic>);
  }

  /// After guest is created, upload the raw image to store in PostgreSQL.
  Future<void> uploadPassportImage(String guestId, File imageFile) async {
    final uri = Uri.parse('$BASE_URL/passport/guests/$guestId/passport-image');
    final request = http.MultipartRequest('POST', uri);

    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    request.files.add(await http.MultipartFile.fromPath('file', imageFile.path));
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode != 200) {
      throw Exception('Image upload failed: ${response.body}');
    }
  }
}
