class Recording {
  final String id;
  final DateTime createdAt;
  final String transcript;
  final String summary;
  String status;
  final DateTime dateRecorded;

  Recording({
    required this.id,
    required this.createdAt,
    required this.transcript,
    required this.summary,
    required this.status,
    required this.dateRecorded,
  });

  factory Recording.fromJson(Map<String, dynamic> json) {
    return Recording(
      id: json['id'],
      createdAt: DateTime.parse(json['created_at']),
      transcript: json['transcript'],
      summary: json['summary'],
      status: json['status'],
      dateRecorded: DateTime.parse(json['date_recorded']),
    );
  }
}
