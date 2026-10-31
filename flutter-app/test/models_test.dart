import 'package:flutter_test/flutter_test.dart';
import 'package:kaoyan_helper/models/models.dart';
import 'package:kaoyan_helper/utils/date_helper.dart';

void main() {
  test('SubjectType.fromId 映射正确', () {
    expect(SubjectType.fromId('math'), SubjectType.math);
    expect(SubjectType.fromId('cs408'), SubjectType.cs408);
    expect(SubjectType.fromId('english'), SubjectType.english);
    expect(SubjectType.fromId('politics'), SubjectType.politics);
    expect(SubjectType.fromId('unknown'), isNull);
    expect(SubjectType.fromId(null), isNull);
  });

  test('科目满分', () {
    expect(subjectFullScore[SubjectType.politics], 100);
    expect(subjectFullScore[SubjectType.english], 100);
    expect(subjectFullScore[SubjectType.math], 150);
    expect(subjectFullScore[SubjectType.cs408], 150);
  });

  test('todayLocal 返回 YYYY-MM-DD 格式', () {
    expect(RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(todayLocal()), isTrue);
  });

  test('PlanItem JSON 往返一致', () {
    const plan = PlanItem(
      id: '1',
      title: '复习数学',
      subject: SubjectType.math,
      createdAt: '2026-10-31T08:00:00.000Z',
      recurring: true,
      completedDates: ['2026-10-31'],
    );
    final restored = PlanItem.fromJson(plan.toJson());
    expect(restored.id, '1');
    expect(restored.title, '复习数学');
    expect(restored.subject, SubjectType.math);
    expect(restored.recurring, true);
    expect(restored.completedDates, ['2026-10-31']);
  });
}
